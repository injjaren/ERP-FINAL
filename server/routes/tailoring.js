'use strict';
/**
 * server/routes/tailoring.js
 * ──────────────────────────
 * REST API for the POS_TAILORING flow.
 * Mounted at /api/tailoring in app.js.
 *
 * Endpoints
 * ─────────
 * GET  /api/tailoring/orders              – list orders (filterable by branch, status, date)
 * POST /api/tailoring/orders              – create new order (+ garments/services inline)
 * GET  /api/tailoring/orders/:id          – full order with garments, services, materials
 * POST /api/tailoring/orders/:id/garments – add a garment to an existing order
 * POST /api/tailoring/orders/:id/deliver  – mark order delivered
 *
 * GET  /api/tailoring/garments/:id        – get single garment (with services + materials)
 * PUT  /api/tailoring/services/:id/status – update service status (IN_PROGRESS | DONE)
 * PUT  /api/tailoring/services/:id/assign – assign an artisan to a service
 *
 * GET  /api/tailoring/catalog             – list service catalog
 * POST /api/tailoring/catalog             – create catalog entry
 */

const router = require('express').Router();
const { db }              = require('../database');
const {
  createOrder,
  addGarmentToOrder,
  updateServiceStatus,
  assignArtisan,
  markOrderDelivered,
  getOrderFull,
}                         = require('../services/tailoringService');

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * GET /api/tailoring/orders
 * Query params: branch_id, status, date_from, date_to, client_id
 */
router.get('/tailoring/orders', (req, res) => {
  try {
    const { branch_id, status, date_from, date_to, client_id } = req.query;
    const cid = req.company_id;

    let where = 'WHERE o.company_id = ?';
    const params = [cid];

    if (branch_id)  { where += ' AND o.branch_id = ?';   params.push(branch_id); }
    if (status)     { where += ' AND o.status = ?';       params.push(status); }
    if (date_from)  { where += ' AND o.order_date >= ?';  params.push(date_from); }
    if (date_to)    { where += ' AND o.order_date <= ?';  params.push(date_to); }
    if (client_id)  { where += ' AND o.client_id = ?';   params.push(client_id); }

    const orders = db.prepare(`
      SELECT
        o.*,
        c.name  AS client_name_resolved,
        c.phone AS client_phone_resolved,
        b.name  AS branch_name,
        (SELECT COUNT(*) FROM tailoring_garments g WHERE g.order_id = o.id) AS garment_count
      FROM tailoring_orders o
      LEFT JOIN clients  c ON c.id = o.client_id
      LEFT JOIN branches b ON b.id = o.branch_id
      ${where}
      ORDER BY o.created_at DESC
    `).all(...params);

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tailoring/orders
 * Body: { branchId, clientId?, clientName?, clientPhone?, orderDate?, notes?, garments? }
 */
router.post('/tailoring/orders', (req, res) => {
  try {
    const result = createOrder({ ...req.body, companyId: req.company_id });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/tailoring/orders/:id
 * Returns full order with nested garments, services, materials.
 */
router.get('/tailoring/orders/:id', (req, res) => {
  try {
    const order = getOrderFull(parseInt(req.params.id), req.company_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tailoring/orders/:id/garments
 * Adds a garment (with optional services + materials) to an existing order.
 * Body: { garmentType, colorId?, quantity?, services?, materials? }
 */
router.post('/tailoring/orders/:id/garments', (req, res) => {
  try {
    const orderId   = parseInt(req.params.id);
    const companyId = req.company_id;
    const garmentId = addGarmentToOrder({ ...req.body, orderId, companyId });
    res.status(201).json({ garmentId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/tailoring/orders/:id/deliver
 * Marks entire order (and all its garments) as DELIVERED.
 */
router.post('/tailoring/orders/:id/deliver', (req, res) => {
  try {
    markOrderDelivered(parseInt(req.params.id), req.company_id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Garments ─────────────────────────────────────────────────────────────────

/**
 * GET /api/tailoring/garments/:id
 * Returns single garment with nested services and materials.
 */
router.get('/tailoring/garments/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const garment = db.prepare(`
      SELECT g.*, cm.color_code, cm.color_family, cm.shade_name
      FROM tailoring_garments g
      LEFT JOIN color_master cm ON cm.id = g.color_id
      WHERE g.id = ? AND g.company_id = ?
    `).get(req.params.id, cid);

    if (!garment) return res.status(404).json({ error: 'Garment not found' });

    garment.services = db.prepare(`
      SELECT ts.*, a.name AS artisan_name
      FROM tailoring_services ts
      LEFT JOIN artisans a ON a.id = ts.artisan_id
      WHERE ts.garment_id = ? AND ts.company_id = ?
      ORDER BY ts.id
    `).all(garment.id, cid);

    garment.materials = db.prepare(`
      SELECT gm.*, pt.name AS product_name_resolved, w.name AS warehouse_name
      FROM garment_materials gm
      LEFT JOIN product_types pt ON pt.id = gm.product_type_id
      LEFT JOIN warehouses    w  ON w.id  = gm.warehouse_id
      WHERE gm.garment_id = ? AND gm.company_id = ?
      ORDER BY gm.id
    `).all(garment.id, cid);

    res.json(garment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * PUT /api/tailoring/services/:id/status
 * Body: { status: 'IN_PROGRESS' | 'DONE' }
 * Triggers material deduction when status → DONE (all services of garment done).
 */
router.put('/tailoring/services/:id/status', (req, res) => {
  try {
    const { status, createdBy } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    updateServiceStatus(parseInt(req.params.id), status, req.company_id, createdBy || 'system');
    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/tailoring/services/:id/assign
 * Body: { artisanId }
 */
router.put('/tailoring/services/:id/assign', (req, res) => {
  try {
    const { artisanId } = req.body;
    if (!artisanId) return res.status(400).json({ error: 'artisanId is required' });
    assignArtisan(parseInt(req.params.id), artisanId, req.company_id);
    res.json({ success: true, artisanId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Service Catalog ──────────────────────────────────────────────────────────

/**
 * GET /api/tailoring/catalog
 * Returns all active service catalog entries for this company.
 */
router.get('/tailoring/catalog', (req, res) => {
  try {
    const catalog = db.prepare(`
      SELECT * FROM service_catalog
      WHERE company_id = ? AND active = 1
      ORDER BY name
    `).all(req.company_id);
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tailoring/catalog
 * Body: { name, nameAr?, unit?, basePrice? }
 */
router.post('/tailoring/catalog', (req, res) => {
  try {
    const { name, nameAr, unit = 'unit', basePrice = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = db.prepare(`
      INSERT INTO service_catalog (company_id, name, name_ar, unit, base_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.company_id, name, nameAr || null, unit, basePrice);
    res.status(201).json({ id: result.lastInsertRowid, name, nameAr, unit, basePrice });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/tailoring/artisans
 * Returns artisans available for tailoring assignments.
 * Optionally filtered by craft_type.
 */
router.get('/tailoring/artisans', (req, res) => {
  try {
    const { craft_type } = req.query;
    let where = 'WHERE a.company_id = ? AND a.active = 1';
    const params = [req.company_id];
    if (craft_type) { where += ' AND a.craft_type = ?'; params.push(craft_type); }
    const artisans = db.prepare(`
      SELECT id, code, name, phone, craft_type, artisan_type
      FROM artisans a ${where}
      ORDER BY a.name
    `).all(...params);
    res.json(artisans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEV-ONLY TEST ENDPOINT ───────────────────────────────────────────────────
// POST /api/dev/create-test-tailoring-order
// Creates a realistic tailoring order for manual testing.
// Disabled automatically in production (NODE_ENV=production).
// REMOVE before go-live.

if (process.env.NODE_ENV !== 'production') {
  router.post('/dev/create-test-tailoring-order', (req, res) => {
    try {
      const companyId = 1;
      const branchId  = 1;

      // 1. Create the order
      const { orderId, orderNumber } = createOrder({
        companyId,
        branchId,
        clientId:    1,
        clientName:  'Test Customer',
        orderDate:   new Date().toISOString().split('T')[0],
        notes:       'DEV test order — created via /api/dev/create-test-tailoring-order',
        createdBy:   'dev-test',
      });

      // 2. Add garment with service + material inline
      const garmentId = addGarmentToOrder({
        orderId,
        companyId,
        garmentType: 'Caftan',
        colorId:     1,
        quantity:    1,
        createdBy:   'dev-test',
        services: [
          {
            serviceType: 'Sfifa',
            quantity:    4,
            unit:        'meter',
            price:       20,
            artisanId:   null,
          },
        ],
        materials: [
          {
            productTypeId: 1,
            colorId:       1,
            quantity:      10,
            unit:          'qiyad',
            // warehouse_id intentionally omitted — will be null
          },
        ],
      });

      // 3. Return the full nested order
      const order = getOrderFull(orderId, companyId);

      res.status(201).json({
        _dev:        true,
        orderNumber,
        orderId,
        garmentId,
        order,
      });
    } catch (err) {
      res.status(400).json({ _dev: true, error: err.message });
    }
  });
}

module.exports = router;

