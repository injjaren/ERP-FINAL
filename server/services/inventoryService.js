'use strict';
/**
 * inventoryService.js
 * ───────────────────
 * Centralised service for all inventory deduction / movement recording.
 * Used by the POS_TAILORING flow when garment materials are consumed on
 * garment completion, and by any future module that needs to touch stock.
 *
 * All movement writes are idempotent-safe because they create rows in
 * inventory_movements rather than mutating the inventory row directly —
 * the inventory.quantity column is updated atomically inside a transaction.
 *
 * Columns written to inventory_movements:
 *   inventory_id, movement_type, quantity, unit_cost,
 *   inventory_stage, warehouse_id, branch_id, color_id, product_id,
 *   reference_type, reference_id, notes, created_by, company_id
 */

const { db } = require('../database');

/**
 * lookupInventory
 * Returns the full inventory row (joined with warehouse + product_type)
 * for a given inventory_id, scoped to company_id.
 *
 * @param {number} inventoryId
 * @param {number} companyId
 * @returns {object|null}
 */
function lookupInventory(inventoryId, companyId) {
  return db.prepare(`
    SELECT
      i.*,
      w.branch_id,
      w.inventory_stage AS wh_stage,
      pt.id             AS pt_id
    FROM inventory i
    LEFT JOIN warehouses   w  ON w.id  = i.warehouse_id
    LEFT JOIN product_types pt ON pt.id = i.product_type_id
    WHERE i.id = ? AND i.company_id = ?
  `).get(inventoryId, companyId);
}

/**
 * recordMovement
 * Creates one row in inventory_movements and adjusts inventory.quantity.
 * Must be called inside a transaction when part of a larger operation.
 *
 * @param {object} opts
 * @param {number}  opts.inventoryId       - inventory row to move
 * @param {string}  opts.movementType      - 'in' | 'out' | 'adjustment'
 * @param {number}  opts.quantity          - absolute quantity (always positive)
 * @param {number}  [opts.unitCost]        - cost per unit for COGS tracking
 * @param {string}  [opts.referenceType]   - e.g. 'tailoring_garment', 'sale'
 * @param {number}  [opts.referenceId]
 * @param {string}  [opts.notes]
 * @param {string}  [opts.createdBy]
 * @param {number}  opts.companyId
 * @returns {{ movementId: number, newQuantity: number }}
 */
function recordMovement({
  inventoryId,
  movementType,
  quantity,
  unitCost,
  referenceType,
  referenceId,
  notes,
  createdBy = 'system',
  companyId,
}) {
  // Load enrichment data from inventory + warehouse
  const inv = lookupInventory(inventoryId, companyId);
  if (!inv) throw new Error(`Inventory row ${inventoryId} not found for company ${companyId}`);

  const effectiveCost = unitCost != null ? unitCost : (inv.unit_cost || 0);
  const qtyDelta      = movementType === 'out' ? -quantity : quantity;

  // Insert movement row with all enrichment columns
  const moveResult = db.prepare(`
    INSERT INTO inventory_movements (
      inventory_id, movement_type, quantity, unit_cost,
      inventory_stage, warehouse_id, branch_id,
      color_id, product_id,
      reference_type, reference_id,
      notes, created_by, company_id
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `).run(
    inventoryId, movementType, quantity, effectiveCost,
    inv.inventory_stage || inv.wh_stage,
    inv.warehouse_id,
    inv.branch_id,
    inv.master_color_id   || null,
    inv.product_type_id   || null,
    referenceType         || null,
    referenceId           || null,
    notes                 || null,
    createdBy,
    companyId,
  );

  // Adjust inventory quantity
  db.prepare(
    `UPDATE inventory SET quantity = quantity + ? WHERE id = ? AND company_id = ?`
  ).run(qtyDelta, inventoryId, companyId);

  // Read back the new quantity
  const updated = db.prepare(`SELECT quantity FROM inventory WHERE id = ?`).get(inventoryId);

  return {
    movementId:  moveResult.lastInsertRowid,
    newQuantity: updated ? updated.quantity : 0,
  };
}

/**
 * consumeGarmentMaterials
 * Deducts all unconsumed garment_materials rows from stock for a given garment.
 * Marks each material row as consumed = 1.
 * Returns a summary of consumed materials.
 *
 * @param {number} garmentId
 * @param {number} companyId
 * @param {string} createdBy
 * @returns {Array<{ materialId, inventoryId, quantity, movementId }>}
 */
function consumeGarmentMaterials(garmentId, companyId, createdBy = 'system') {
  const materials = db.prepare(`
    SELECT gm.*, i.id AS inventory_id, i.quantity AS stock_qty, i.unit_cost AS inv_cost
    FROM garment_materials gm
    LEFT JOIN inventory i ON (
      i.warehouse_id    = gm.warehouse_id
      AND i.product_type_id = gm.product_type_id
      AND COALESCE(i.master_color_id, 0) = COALESCE(gm.color_id, 0)
      AND i.company_id  = gm.company_id
    )
    WHERE gm.garment_id = ? AND gm.company_id = ? AND gm.consumed = 0
  `).all(garmentId, companyId);

  const results = [];

  const txn = db.transaction(() => {
    for (const mat of materials) {
      if (!mat.inventory_id) {
        // No matching inventory row found — record as unconsumed warning
        results.push({ materialId: mat.id, inventoryId: null, quantity: mat.quantity, movementId: null, warning: 'No matching inventory row found' });
        continue;
      }
      if (mat.stock_qty < mat.quantity) {
        results.push({ materialId: mat.id, inventoryId: mat.inventory_id, quantity: mat.quantity, movementId: null, warning: `Insufficient stock: ${mat.stock_qty} available` });
        continue;
      }

      const { movementId, newQuantity } = recordMovement({
        inventoryId:   mat.inventory_id,
        movementType:  'out',
        quantity:      mat.quantity,
        unitCost:      mat.inv_cost,
        referenceType: 'tailoring_garment',
        referenceId:   garmentId,
        notes:         `استهلاك مواد قطعة خياطة رقم ${garmentId}`,
        createdBy,
        companyId,
      });

      // Mark as consumed
      db.prepare(`UPDATE garment_materials SET consumed = 1 WHERE id = ? AND company_id = ?`)
        .run(mat.id, companyId);

      results.push({ materialId: mat.id, inventoryId: mat.inventory_id, quantity: mat.quantity, movementId, newQuantity });
    }
  });

  txn();
  return results;
}

module.exports = { lookupInventory, recordMovement, consumeGarmentMaterials };
