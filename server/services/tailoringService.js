'use strict';
/**
 * tailoringService.js
 * ───────────────────
 * Business-logic layer for the POS_TAILORING flow (docs/01_BUSINESS_MODEL.md).
 *
 * Hierarchy:
 *   tailoring_orders  (one per customer visit)
 *     └ tailoring_garments  (one per garment brought in)
 *         └ tailoring_services  (one per finishing service: Sfifa, Akaad…)
 *         └ garment_materials   (materials consumed when garment is completed)
 *
 * Key business rules:
 *  1. Order number auto-generated as TO-{companyId}-{YYYYMMDD}-{seq}
 *  2. Order status auto-derived from garment statuses (do not set manually).
 *  3. Garment status auto-derived from service statuses.
 *  4. Material deduction happens when a garment reaches READY status.
 *  5. All writes use transactions — partial state is never committed.
 */

const { db }                     = require('../database');
const { consumeGarmentMaterials } = require('./inventoryService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a unique order number: TO-{companyId}-{YYYYMMDD}-{padded seq}
 */
function generateOrderNumber(companyId) {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `TO-${companyId}-${today}`;
  const last = db.prepare(`
    SELECT order_number FROM tailoring_orders
    WHERE company_id = ? AND order_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(companyId, `${prefix}-%`);
  const seq = last ? parseInt(last.order_number.split('-').pop(), 10) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Derive order status from its garments.
 * Called after any garment status change.
 */
function deriveOrderStatus(orderId) {
  const garments = db.prepare(`SELECT status FROM tailoring_garments WHERE order_id = ?`).all(orderId);
  if (!garments.length) return 'NEW';
  const statuses = garments.map(g => g.status);
  if (statuses.every(s => s === 'DELIVERED'))         return 'DELIVERED';
  if (statuses.every(s => s === 'READY' || s === 'DELIVERED')) return 'READY';
  if (statuses.some(s => s === 'READY'))              return 'PARTIAL_READY';
  if (statuses.some(s => s === 'IN_PRODUCTION'))      return 'IN_PRODUCTION';
  return 'NEW';
}

/**
 * Derive garment status from its services.
 * Called after any service status change.
 */
function deriveGarmentStatus(garmentId) {
  const services = db.prepare(`SELECT status FROM tailoring_services WHERE garment_id = ?`).all(garmentId);
  if (!services.length) return 'PENDING';
  const statuses = services.map(s => s.status);
  if (statuses.every(s => s === 'DONE'))         return 'READY';
  if (statuses.some(s => s === 'IN_PROGRESS'))   return 'IN_PRODUCTION';
  return 'PENDING';
}

// ─── Order operations ────────────────────────────────────────────────────────

/**
 * createOrder
 * Creates a tailoring_orders row with optional garments and services.
 *
 * @param {object} data
 * @param {number}  data.companyId
 * @param {number}  data.branchId
 * @param {number}  [data.clientId]
 * @param {string}  [data.clientName]
 * @param {string}  [data.clientPhone]
 * @param {string}  [data.orderDate]     - ISO date, defaults to today
 * @param {string}  [data.notes]
 * @param {string}  [data.createdBy]
 * @param {Array}   [data.garments]      - see createGarment for shape
 * @returns {{ orderId, orderNumber }}
 */
function createOrder(data) {
  const {
    companyId, branchId, clientId, clientName, clientPhone,
    orderDate, notes, createdBy = 'system', garments = [],
  } = data;

  if (!branchId) throw new Error('branchId is required');

  const orderNumber = generateOrderNumber(companyId);

  const txn = db.transaction(() => {
    const orderResult = db.prepare(`
      INSERT INTO tailoring_orders
        (order_number, company_id, branch_id, client_id, client_name, client_phone,
         order_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber, companyId, branchId,
      clientId || null, clientName || null, clientPhone || null,
      orderDate || new Date().toISOString().split('T')[0],
      notes || null, createdBy,
    );
    const orderId = orderResult.lastInsertRowid;

    // Attach garments if provided inline
    for (const g of garments) {
      addGarmentToOrder({ ...g, orderId, companyId, createdBy });
    }

    // Recalculate total_price
    recalcOrderTotal(orderId, companyId);

    return { orderId, orderNumber };
  });

  return txn();
}

/**
 * addGarmentToOrder
 * Adds one garment (with its services and materials) to an existing order.
 *
 * @param {object} data
 * @param {number}  data.orderId
 * @param {number}  data.companyId
 * @param {string}  data.garmentType  - e.g. 'Caftan', 'Djellaba'
 * @param {number}  [data.colorId]    - FK to color_master
 * @param {string}  [data.colorDesc]
 * @param {number}  [data.quantity]
 * @param {string}  [data.notes]
 * @param {Array}   [data.services]   - [{ serviceType, quantity, unit, price, artisanId }]
 * @param {Array}   [data.materials]  - [{ warehouseId, productTypeId, colorId, quantity, unit }]
 * @returns {number} garmentId
 */
function addGarmentToOrder(data) {
  const {
    orderId, companyId, garmentType, colorId, colorDesc, quantity = 1,
    notes, createdBy = 'system', services = [], materials = [],
  } = data;

  if (!orderId) throw new Error('orderId is required');
  if (!garmentType) throw new Error('garmentType is required');

  const txn = db.transaction(() => {
    const garmentResult = db.prepare(`
      INSERT INTO tailoring_garments
        (order_id, company_id, garment_type, color_id, color_desc, quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, companyId, garmentType, colorId || null, colorDesc || null, quantity, notes || null);
    const garmentId = garmentResult.lastInsertRowid;

    // Attach services
    for (const svc of services) {
      db.prepare(`
        INSERT INTO tailoring_services
          (garment_id, company_id, service_type, quantity, unit, price, artisan_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        garmentId, companyId, svc.serviceType,
        svc.quantity || 1, svc.unit || 'unit',
        svc.price    || 0, svc.artisanId || null,
      );
    }

    // Attach materials
    for (const mat of materials) {
      db.prepare(`
        INSERT INTO garment_materials
          (garment_id, company_id, warehouse_id, product_type_id, color_id, product_name, quantity, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        garmentId, companyId,
        mat.warehouseId    || null,
        mat.productTypeId  || null,
        mat.colorId        || null,
        mat.productName    || null,
        mat.quantity,
        mat.unit           || 'unit',
      );
    }

    // Update order status
    const newStatus = deriveOrderStatus(orderId);
    db.prepare(`UPDATE tailoring_orders SET status = ? WHERE id = ? AND company_id = ?`)
      .run(newStatus, orderId, companyId);

    recalcOrderTotal(orderId, companyId);

    return garmentId;
  });

  return txn();
}

// ─── Service operations ──────────────────────────────────────────────────────

/**
 * updateServiceStatus
 * Sets a service status (ASSIGNED → IN_PROGRESS → DONE).
 * Auto-propagates status up to the garment and then the order.
 * When a service becomes DONE, sets done_at timestamp.
 * When all services of a garment are DONE, triggers material deduction.
 *
 * @param {number} serviceId
 * @param {string} newStatus   - 'IN_PROGRESS' | 'DONE'
 * @param {number} companyId
 * @param {string} [createdBy]
 */
function updateServiceStatus(serviceId, newStatus, companyId, createdBy = 'system') {
  const validTransitions = ['ASSIGNED', 'IN_PROGRESS', 'DONE'];
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Invalid service status: ${newStatus}`);
  }

  const svc = db.prepare(`SELECT * FROM tailoring_services WHERE id = ? AND company_id = ?`).get(serviceId, companyId);
  if (!svc) throw new Error(`Service ${serviceId} not found`);

  const txn = db.transaction(() => {
    const doneAt = newStatus === 'DONE' ? new Date().toISOString() : null;
    db.prepare(`
      UPDATE tailoring_services
      SET status = ?, done_at = COALESCE(?, done_at)
      WHERE id = ? AND company_id = ?
    `).run(newStatus, doneAt, serviceId, companyId);

    // Propagate to garment
    const garmentStatus = deriveGarmentStatus(svc.garment_id);
    db.prepare(`UPDATE tailoring_garments SET status = ? WHERE id = ? AND company_id = ?`)
      .run(garmentStatus, svc.garment_id, companyId);

    // If garment just became READY — consume materials
    if (garmentStatus === 'READY') {
      consumeGarmentMaterials(svc.garment_id, companyId, createdBy);
    }

    // Propagate to order
    const garment = db.prepare(`SELECT order_id FROM tailoring_garments WHERE id = ?`).get(svc.garment_id);
    if (garment) {
      const orderStatus = deriveOrderStatus(garment.order_id);
      db.prepare(`UPDATE tailoring_orders SET status = ? WHERE id = ? AND company_id = ?`)
        .run(orderStatus, garment.order_id, companyId);
    }
  });

  txn();
}

/**
 * assignArtisan
 * Assigns an artisan to a specific service within the order.
 */
function assignArtisan(serviceId, artisanId, companyId) {
  const result = db.prepare(`
    UPDATE tailoring_services SET artisan_id = ? WHERE id = ? AND company_id = ?
  `).run(artisanId, serviceId, companyId);
  if (!result.changes) throw new Error(`Service ${serviceId} not found`);
}

// ─── Order delivery ───────────────────────────────────────────────────────────

/**
 * markOrderDelivered
 * Marks all READY garments in an order as DELIVERED, then recalculates order status.
 */
function markOrderDelivered(orderId, companyId) {
  db.transaction(() => {
    db.prepare(`
      UPDATE tailoring_garments SET status = 'DELIVERED'
      WHERE order_id = ? AND company_id = ? AND status IN ('READY','IN_PRODUCTION','PENDING')
    `).run(orderId, companyId);

    const orderStatus = deriveOrderStatus(orderId);
    db.prepare(`UPDATE tailoring_orders SET status = ? WHERE id = ? AND company_id = ?`)
      .run(orderStatus, orderId, companyId);
  })();
}

// ─── Totals ───────────────────────────────────────────────────────────────────

/**
 * Recalculate and persist total_price for a tailoring order.
 * = SUM of all tailoring_services.price × quantity within the order.
 */
function recalcOrderTotal(orderId, companyId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(ts.price * ts.quantity), 0) AS total
    FROM tailoring_services ts
    JOIN tailoring_garments tg ON tg.id = ts.garment_id
    WHERE tg.order_id = ? AND tg.company_id = ?
  `).get(orderId, companyId);
  db.prepare(`UPDATE tailoring_orders SET total_price = ? WHERE id = ? AND company_id = ?`)
    .run(row.total, orderId, companyId);
}

// ─── Read helpers ────────────────────────────────────────────────────────────

/**
 * getOrderFull
 * Returns an order with all garments, services, and materials nested.
 */
function getOrderFull(orderId, companyId) {
  const order = db.prepare(`
    SELECT o.*, c.name AS client_name_resolved
    FROM tailoring_orders o
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ? AND o.company_id = ?
  `).get(orderId, companyId);
  if (!order) return null;

  const garments = db.prepare(`
    SELECT g.*, cm.color_code, cm.color_family, cm.shade_name
    FROM tailoring_garments g
    LEFT JOIN color_master cm ON cm.id = g.color_id
    WHERE g.order_id = ? AND g.company_id = ?
    ORDER BY g.id
  `).all(orderId, companyId);

  for (const g of garments) {
    g.services = db.prepare(`
      SELECT ts.*, a.name AS artisan_name
      FROM tailoring_services ts
      LEFT JOIN artisans a ON a.id = ts.artisan_id
      WHERE ts.garment_id = ? AND ts.company_id = ?
      ORDER BY ts.id
    `).all(g.id, companyId);

    g.materials = db.prepare(`
      SELECT gm.*, pt.name AS product_name_resolved, w.name AS warehouse_name
      FROM garment_materials gm
      LEFT JOIN product_types pt ON pt.id = gm.product_type_id
      LEFT JOIN warehouses    w  ON w.id  = gm.warehouse_id
      WHERE gm.garment_id = ? AND gm.company_id = ?
      ORDER BY gm.id
    `).all(g.id, companyId);
  }

  order.garments = garments;
  return order;
}

module.exports = {
  createOrder,
  addGarmentToOrder,
  updateServiceStatus,
  assignArtisan,
  markOrderDelivered,
  recalcOrderTotal,
  getOrderFull,
  generateOrderNumber,
  deriveOrderStatus,
  deriveGarmentStatus,
};
