'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { JAAB_KG_PER_BAG, requireJomlaBranch, recalcBatchCosts } = require('./helpers');

// ── GET /api/manufacturing/batches ────────────────────────────────────────────
router.get('/manufacturing/batches', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;

    const batches = db.prepare(`
      SELECT pb.*,
             b.name AS branch_name
      FROM production_batches pb
      LEFT JOIN branches b ON pb.branch_id = b.id AND b.company_id = pb.company_id
      WHERE pb.company_id = ? AND pb.branch_id = ?
      ORDER BY pb.created_at DESC
    `).all(cid, jomla.id);

    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/manufacturing/batches ───────────────────────────────────────────
router.post('/manufacturing/batches', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;

    const { batch_code } = req.body;
    if (!batch_code) return res.status(400).json({ error: 'batch_code is required' });

    const result = db.prepare(`
      INSERT INTO production_batches (batch_code, branch_id, company_id)
      VALUES (?, ?, ?)
    `).run(batch_code, jomla.id, cid);

    const batch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ?`
    ).get(result.lastInsertRowid, cid);

    res.status(201).json(batch);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: `Batch code already exists: ${req.body.batch_code}` });
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/manufacturing/batches/:id ────────────────────────────────────────
router.get('/manufacturing/batches/:id', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;
    const { id } = req.params;

    const batch = db.prepare(`
      SELECT pb.*, b.name AS branch_name
      FROM production_batches pb
      LEFT JOIN branches b ON pb.branch_id = b.id AND b.company_id = pb.company_id
      WHERE pb.id = ? AND pb.company_id = ? AND pb.branch_id = ?
    `).get(id, cid, jomla.id);

    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const entries = db.prepare(`
      SELECT pe.*, a.name AS artisan_name
      FROM production_entries pe
      LEFT JOIN artisans a ON pe.artisan_id = a.id AND a.company_id = pe.company_id
      WHERE pe.batch_id = ? AND pe.company_id = ?
      ORDER BY pe.created_at ASC
    `).all(id, cid);

    const materials = db.prepare(`
      SELECT pmu.*,
             pt.name AS material_name,
             pt.unit AS material_unit,
             w.name  AS warehouse_name
      FROM production_material_usage pmu
      LEFT JOIN inventory    inv ON pmu.material_inventory_id = inv.id
      LEFT JOIN product_types pt ON inv.product_type_id = pt.id  AND pt.company_id = pmu.company_id
      LEFT JOIN warehouses    w  ON inv.warehouse_id    = w.id   AND w.company_id  = pmu.company_id
      WHERE pmu.batch_id = ? AND pmu.company_id = ?
      ORDER BY pmu.id ASC
    `).all(id, cid);

    // Theoretical jaab calculation
    const theoretical_jaab_bags = batch.total_produced_kg / JAAB_KG_PER_BAG;

    res.json({ ...batch, entries, materials, theoretical_jaab_bags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/manufacturing/batches/:id/entries ───────────────────────────────
// Records artisan production. Applies theoretical jaab deduction from inventory.
// Body: { artisan_id, produced_kg, labor_rate_per_kg, jaab_inventory_id? }
router.post('/manufacturing/batches/:id/entries', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;
    const batchId = Number(req.params.id);

    const batch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ? AND branch_id = ?`
    ).get(batchId, cid, jomla.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status === 'closed') return res.status(409).json({ error: 'Cannot add entries to a closed batch' });

    const { artisan_id, produced_kg, labor_rate_per_kg = 0, jaab_inventory_id } = req.body;
    if (!produced_kg || produced_kg <= 0) return res.status(400).json({ error: 'produced_kg must be > 0' });

    const labor_cost = produced_kg * labor_rate_per_kg;

    // Theoretical jaab usage (Phase 2)
    const jaab_bags_theoretical = produced_kg / JAAB_KG_PER_BAG;
    let jaabCostAdded = 0;

    const addEntriesTx = db.transaction(() => {
      // 1. Insert production entry
      db.prepare(`
        INSERT INTO production_entries (batch_id, artisan_id, produced_kg, labor_rate_per_kg, labor_cost, company_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(batchId, artisan_id || null, produced_kg, labor_rate_per_kg, labor_cost, cid);

      // 2. Jaab inventory deduction (theoretical, weighted average)
      if (jaab_inventory_id) {
        const jaabInv = db.prepare(
          `SELECT * FROM inventory WHERE id = ? AND company_id = ?`
        ).get(jaab_inventory_id, cid);

        if (jaabInv && jaabInv.quantity > 0) {
          const unitCost      = jaabInv.unit_cost || 0;
          const deductQty     = Math.min(jaab_bags_theoretical, jaabInv.quantity);
          jaabCostAdded       = deductQty * unitCost;

          // Deduct from inventory
          db.prepare(
            `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND company_id = ?`
          ).run(deductQty, jaab_inventory_id, cid);

          // Record movement
          db.prepare(`
            INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, company_id)
            VALUES (?, 'out', ?, ?, 'production_batch', ?, ?)
          `).run(jaab_inventory_id, deductQty, unitCost, batchId, cid);

          // Accumulate jaab_cost on batch
          db.prepare(
            `UPDATE production_batches SET jaab_cost = jaab_cost + ? WHERE id = ? AND company_id = ?`
          ).run(jaabCostAdded, batchId, cid);
        }
      }

      // 3. Recalculate batch totals
      recalcBatchCosts(batchId, cid);
    });

    addEntriesTx();

    const updatedBatch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ?`
    ).get(batchId, cid);

    res.status(201).json({
      message: 'Entry recorded',
      labor_cost,
      jaab_bags_theoretical: +jaab_bags_theoretical.toFixed(4),
      jaab_cost_added: jaabCostAdded,
      batch: updatedBatch
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── POST /api/manufacturing/batches/:id/materials ─────────────────────────────
// Records raw material consumption from inventory (weighted average cost).
// Body: { material_inventory_id, quantity_used }
router.post('/manufacturing/batches/:id/materials', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;
    const batchId = Number(req.params.id);

    const batch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ? AND branch_id = ?`
    ).get(batchId, cid, jomla.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status === 'closed') return res.status(409).json({ error: 'Cannot add materials to a closed batch' });

    const { material_inventory_id, quantity_used } = req.body;
    if (!material_inventory_id) return res.status(400).json({ error: 'material_inventory_id is required' });
    if (!quantity_used || quantity_used <= 0) return res.status(400).json({ error: 'quantity_used must be > 0' });

    const addMaterialTx = db.transaction(() => {
      const inv = db.prepare(
        `SELECT * FROM inventory WHERE id = ? AND company_id = ?`
      ).get(material_inventory_id, cid);
      if (!inv) throw new Error('Inventory item not found');
      if (inv.quantity < quantity_used) throw new Error(`Insufficient stock: available ${inv.quantity}`);

      const unitCost  = inv.unit_cost || 0;
      const cost_used = quantity_used * unitCost;

      // Deduct from inventory
      db.prepare(
        `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND company_id = ?`
      ).run(quantity_used, material_inventory_id, cid);

      // Record movement
      db.prepare(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, company_id)
        VALUES (?, 'out', ?, ?, 'production_batch', ?, ?)
      `).run(material_inventory_id, quantity_used, unitCost, batchId, cid);

      // Record material usage
      db.prepare(`
        INSERT INTO production_material_usage (batch_id, material_inventory_id, quantity_used, cost_used, company_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(batchId, material_inventory_id, quantity_used, cost_used, cid);

      recalcBatchCosts(batchId, cid);
      return cost_used;
    });

    const cost_used = addMaterialTx();
    const updatedBatch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ?`
    ).get(batchId, cid);

    res.status(201).json({ message: 'Material usage recorded', cost_used, batch: updatedBatch });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── POST /api/manufacturing/batches/:id/close ─────────────────────────────────
// Closes a batch: allocates overhead and computes full_cost.
// Overhead = total branch expenses for the batch's month ÷ total produced kg for that month.
// Body: { overhead_per_kg? }  — if provided, skips auto-calculation
router.post('/manufacturing/batches/:id/close', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;
    const batchId = Number(req.params.id);

    const batch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ? AND branch_id = ?`
    ).get(batchId, cid, jomla.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status === 'closed') return res.status(409).json({ error: 'Batch already closed' });
    if (batch.total_produced_kg <= 0) return res.status(400).json({ error: 'Cannot close batch with zero production' });

    // Determine overhead_per_kg
    let overhead_per_kg = req.body.overhead_per_kg;

    if (overhead_per_kg === undefined || overhead_per_kg === null) {
      // Auto-calculate from expenses for the batch month
      const batchMonth = batch.created_at.slice(0, 7); // YYYY-MM
      const monthStart = batchMonth + '-01';
      const monthEnd   = batchMonth + '-31';

      const totalExpenses = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE company_id = ? AND date >= ? AND date <= ?
      `).get(cid, monthStart, monthEnd).total;

      const totalKgMonth = db.prepare(`
        SELECT COALESCE(SUM(total_produced_kg), 0) AS total
        FROM production_batches
        WHERE company_id = ? AND branch_id = ?
          AND created_at >= ? AND created_at <= ?
      `).get(cid, jomla.id, monthStart + ' 00:00:00', monthEnd + ' 23:59:59').total;

      overhead_per_kg = totalKgMonth > 0 ? totalExpenses / totalKgMonth : 0;
    }

    const overhead_allocated = overhead_per_kg * batch.total_produced_kg;
    const full_cost = batch.total_direct_cost + overhead_allocated;
    const closedAt  = new Date().toISOString();

    db.prepare(`
      UPDATE production_batches
      SET status             = 'closed',
          overhead_allocated = ?,
          full_cost          = ?,
          closed_at          = ?
      WHERE id = ? AND company_id = ?
    `).run(overhead_allocated, full_cost, closedAt, batchId, cid);

    const closedBatch = db.prepare(
      `SELECT * FROM production_batches WHERE id = ? AND company_id = ?`
    ).get(batchId, cid);

    res.json({
      message:           'Batch closed',
      overhead_per_kg:   +overhead_per_kg.toFixed(4),
      overhead_allocated: +overhead_allocated.toFixed(2),
      full_cost:          +full_cost.toFixed(2),
      batch:              closedBatch
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── GET /api/manufacturing/cost-analysis ──────────────────────────────────────
// Phase 5: full cost breakdown per batch (direct + overhead + cost per kg)
router.get('/manufacturing/cost-analysis', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;

    const { from, to, status } = req.query;
    const where  = ['pb.company_id = ?', 'pb.branch_id = ?'];
    const params = [cid, jomla.id];

    if (from)   { where.push('DATE(pb.created_at) >= ?'); params.push(from); }
    if (to)     { where.push('DATE(pb.created_at) <= ?'); params.push(to);   }
    if (status) { where.push('pb.status = ?');            params.push(status); }

    const batches = db.prepare(`
      SELECT
        pb.id,
        pb.batch_code,
        pb.status,
        pb.created_at,
        pb.closed_at,
        pb.total_produced_kg,
        pb.direct_material_cost,
        pb.direct_labor_cost,
        pb.jaab_cost,
        pb.total_direct_cost,
        pb.overhead_allocated,
        pb.full_cost,
        CASE WHEN pb.total_produced_kg > 0
             THEN ROUND(pb.full_cost / pb.total_produced_kg, 4)
             ELSE 0 END AS cost_per_kg,
        CASE WHEN pb.total_produced_kg > 0
             THEN ROUND(pb.total_direct_cost / pb.total_produced_kg, 4)
             ELSE 0 END AS direct_cost_per_kg
      FROM production_batches pb
      WHERE ${where.join(' AND ')}
      ORDER BY pb.created_at DESC
    `).all(...params);

    const summary = {
      total_batches:       batches.length,
      total_produced_kg:   batches.reduce((s, b) => s + b.total_produced_kg,    0),
      total_material_cost: batches.reduce((s, b) => s + b.direct_material_cost, 0),
      total_labor_cost:    batches.reduce((s, b) => s + b.direct_labor_cost,    0),
      total_jaab_cost:     batches.reduce((s, b) => s + b.jaab_cost,            0),
      total_overhead:      batches.reduce((s, b) => s + b.overhead_allocated,   0),
      total_full_cost:     batches.reduce((s, b) => s + b.full_cost,            0),
    };

    res.json({ summary, batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/manufacturing/jaab-efficiency ────────────────────────────────────
// Phase 5: theoretical jaab usage vs recorded jaab cost, with deviation alert >5%
router.get('/manufacturing/jaab-efficiency', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;

    // Find jaab inventory item(s) — by product name containing 'jaab' or 'جاب'
    const jaabItems = db.prepare(`
      SELECT inv.id, inv.quantity, inv.unit_cost, pt.name AS product_name
      FROM inventory inv
      LEFT JOIN product_types pt ON inv.product_type_id = pt.id AND pt.company_id = inv.company_id
      WHERE inv.company_id = ?
        AND (LOWER(pt.name) LIKE '%jaab%' OR pt.name LIKE '%جاب%')
    `).all(cid);

    const batches = db.prepare(`
      SELECT id, batch_code, status, total_produced_kg, jaab_cost, created_at
      FROM production_batches
      WHERE company_id = ? AND branch_id = ?
      ORDER BY created_at DESC
    `).all(cid, jomla.id);

    const analysis = batches.map(b => {
      const theoretical_bags = b.total_produced_kg / JAAB_KG_PER_BAG;
      // Actual cost-implied bags (if jaab unit_cost is known)
      const jaabUnitCost = jaabItems.length > 0 ? (jaabItems[0].unit_cost || 0) : 0;
      const actual_bags_equivalent = jaabUnitCost > 0 ? b.jaab_cost / jaabUnitCost : null;

      let deviation_pct = null;
      let needs_review  = false;
      if (actual_bags_equivalent !== null && theoretical_bags > 0) {
        deviation_pct = ((actual_bags_equivalent - theoretical_bags) / theoretical_bags) * 100;
        needs_review  = Math.abs(deviation_pct) > 5;
      }

      return {
        batch_id:               b.id,
        batch_code:             b.batch_code,
        status:                 b.status,
        total_produced_kg:      b.total_produced_kg,
        theoretical_jaab_bags:  +theoretical_bags.toFixed(4),
        actual_jaab_bags_equiv: actual_bags_equivalent !== null ? +actual_bags_equivalent.toFixed(4) : null,
        jaab_cost:              b.jaab_cost,
        deviation_pct:          deviation_pct !== null ? +deviation_pct.toFixed(2) : null,
        needs_review,
        suggestion:             needs_review
          ? `Deviation ${deviation_pct > 0 ? '+' : ''}${deviation_pct.toFixed(1)}% — verify jaab unit cost or production records`
          : null
      };
    });

    res.json({
      jaab_kg_per_bag: JAAB_KG_PER_BAG,
      jaab_inventory:  jaabItems,
      batches:         analysis
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/manufacturing/overhead-preview ───────────────────────────────────
// Phase 4: real-time provisional overhead for current month
router.get('/manufacturing/overhead-preview', (req, res) => {
  try {
    const jomla = requireJomlaBranch(req, res);
    if (!jomla) return;
    const cid = req.company_id;

    const { month } = req.query; // YYYY-MM, defaults to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const monthStart  = targetMonth + '-01';
    const monthEnd    = targetMonth + '-31';

    const totalExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE company_id = ? AND date >= ? AND date <= ?
    `).get(cid, monthStart, monthEnd).total;

    const totalKg = db.prepare(`
      SELECT COALESCE(SUM(total_produced_kg), 0) AS total
      FROM production_batches
      WHERE company_id = ? AND branch_id = ?
        AND created_at >= ? AND created_at <= ?
    `).get(cid, jomla.id, monthStart + ' 00:00:00', monthEnd + ' 23:59:59').total;

    const overhead_per_kg = totalKg > 0 ? totalExpenses / totalKg : 0;

    res.json({
      month:             targetMonth,
      total_expenses:    +totalExpenses.toFixed(2),
      total_produced_kg: +totalKg.toFixed(4),
      overhead_per_kg:   +overhead_per_kg.toFixed(4),
      note:              totalKg === 0 ? 'No production recorded yet this month' : 'Provisional — updates as batches are added'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
