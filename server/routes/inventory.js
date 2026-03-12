'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { logAudit, postJournal,
        validateInventoryStage, ensureColorInSystem,
        KG_TO_OZ, VALID_STAGES } = require('../utils');

const MASTER_COLOR_WRITE_BRANCH = 'الجملة'; // only this branch may create or mutate colors

// ============================================
// API ENDPOINTS - INVENTORY
// ============================================

router.get('/inventory', (req, res) => {
  try {
    const { stage, warehouse_id } = req.query;
    let where = 'WHERE i.company_id = ? AND i.branch_id = ?';
    const params = [req.company_id, req.branch_id];
    if (stage && VALID_STAGES.includes(stage)) { where += ' AND i.inventory_stage = ?'; params.push(stage); }
    if (warehouse_id) { where += ' AND i.warehouse_id = ?'; params.push(warehouse_id); }
    const inventory = db.prepare(`
      SELECT i.*,
             w.name  AS warehouse_name, w.branch_id, w.inventory_stage AS wh_stage,
             pt.name AS product_name, pt.category, pt.unit,
             cc.code AS color_code, cc.main_color, cc.shade,
             COALESCE(cc.code, i.color_description, 'بدون') AS display_color,
             mc.color_code   AS mc_color_code,
             mc.color_family AS color_family,
             mc.shade_name   AS shade_name,
             mc.hex_code     AS hex_code
      FROM inventory i
      LEFT JOIN warehouses    w  ON i.warehouse_id    = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes   cc ON i.color_code_id   = cc.id
      LEFT JOIN master_colors mc ON i.master_color_id = mc.id
      ${where}
      ORDER BY w.name, pt.name, cc.code
    `).all(...params);
    res.json(inventory);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/inventory', (req, res) => {
  try {
    const { warehouse_id, product_type_id, color_code_id, color_code, color_name, color_shade,
            color_description, master_color_id, quantity, unit_cost, unit_price, opening_balance,
            branch, inventory_stage } = req.body;
    const cid = req.company_id;
    const bid = req.branch_id || 1;

    // Resolve inventory_stage: explicit > warehouse default > 'wholesale_kg'
    let stage = inventory_stage;
    if (!stage && warehouse_id) {
      const wh = db.prepare('SELECT inventory_stage FROM warehouses WHERE id = ? AND company_id = ?').get(warehouse_id, cid);
      if (wh && wh.inventory_stage) stage = wh.inventory_stage;
    }
    if (!stage) stage = 'wholesale_kg';

    // Validate stage
    const stageCheck = validateInventoryStage(stage, warehouse_id, cid);
    if (!stageCheck.ok) return res.status(400).json({ error: stageCheck.error });

    // ── master_color_id guard: must exist and be active in this company ───────
    if (master_color_id) {
      const mc = db.prepare(
        `SELECT id FROM master_colors WHERE id = ? AND company_id = ? AND is_active = 1`
      ).get(master_color_id, cid);
      if (!mc) return res.status(400).json({
        error: `master_color_id ${master_color_id} غير موجود أو غير نشط في قائمة الألوان الرئيسية`
      });
    }

    let finalColorCodeId = color_code_id;

    // If new color code text provided — only الجملة branch may create new color entries
    if (color_code && color_name && !color_code_id) {
      if (branch !== MASTER_COLOR_WRITE_BRANCH) {
        return res.status(403).json({
          error: `إنشاء لون جديد مرفوض — الفرع "${branch || '(غير محدد)'}" لا يملك صلاحية إنشاء ألوان. استخدم الألوان الموجودة في القائمة الرئيسية`,
          allowed_branch: MASTER_COLOR_WRITE_BRANCH,
          provided_branch: branch || null
        });
      }
      const existingColor = db.prepare(
        'SELECT id FROM color_codes WHERE code = ? AND company_id = ?'
      ).get(color_code, cid);
      if (existingColor) {
        finalColorCodeId = existingColor.id;
      } else {
        const colorResult = db.prepare(
          `INSERT INTO color_codes (code, main_color, shade, active, company_id) VALUES (?, ?, ?, 1, ?)`
        ).run(color_code, color_name, color_shade || null, cid);
        finalColorCodeId = colorResult.lastInsertRowid;
        logAudit('color_codes', finalColorCodeId, 'create', null,
          { code: color_code, main_color: color_name, shade: color_shade }, req.body.user || 'system');
      }
    }

    // Fallback color auto-sync: if no color_code_id resolved but color_description given
    if (!finalColorCodeId && color_description) {
      const colorSync = ensureColorInSystem(color_description, cid, null);
      if (colorSync) finalColorCodeId = colorSync.color_code_id;
    }

    // Check for existing inventory row in this warehouse + company + color + stage
    const existing = db.prepare(`
      SELECT id, quantity, unit_cost, unit_price FROM inventory
      WHERE warehouse_id = ? AND product_type_id = ? AND company_id = ? AND branch_id = ?
        AND COALESCE(color_code_id, 0) = COALESCE(?, 0)
        AND inventory_stage = ?
    `).get(warehouse_id, product_type_id, cid, bid, finalColorCodeId || null, stage);

    if (existing) {
      // Merge: add quantity, update cost/price, and link master_color_id if supplied
      const newQty   = (existing.quantity  || 0) + (quantity  || 0);
      const newCost  =  unit_cost  || existing.unit_cost  || 0;
      const newPrice =  unit_price || existing.unit_price || 0;
      db.prepare(`
        UPDATE inventory
        SET quantity = ?, unit_cost = ?, unit_price = ?,
            master_color_id = COALESCE(?, master_color_id)
        WHERE id = ? AND company_id = ? AND branch_id = ?
      `).run(newQty, newCost, newPrice, master_color_id || null, existing.id, cid, bid);

      if (quantity > 0) {
        db.prepare(`
          INSERT INTO inventory_movements
            (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by, company_id, branch_id)
          VALUES (?, 'in', ?, ?, 'manual', ?, ?, ?, ?)
        `).run(existing.id, quantity, unit_cost || 0, 'إضافة مخزون - دمج تلقائي', req.body.user || 'system', cid, bid);
      }
      logAudit('inventory', existing.id, 'update', existing,
        { quantity: newQty, unit_cost: newCost, unit_price: newPrice }, req.body.user || 'system');
      res.status(200).json({ id: existing.id, merged: true,
        color_code_id: finalColorCodeId, master_color_id: master_color_id || null, ...req.body });
    } else {
      const result = db.prepare(`
        INSERT INTO inventory
          (warehouse_id, product_type_id, color_code_id, color_description,
           master_color_id, inventory_stage, quantity, unit_cost, unit_price, opening_balance, company_id, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(warehouse_id, product_type_id, finalColorCodeId || null, color_description || null,
             master_color_id || null, stage, quantity || 0, unit_cost || 0, unit_price || 0,
             opening_balance || 0, cid, bid);
      logAudit('inventory', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
      res.status(201).json({ id: result.lastInsertRowid,
        color_code_id: finalColorCodeId, master_color_id: master_color_id || null, ...req.body });
    }
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/inventory/movement', (req, res) => {
  try {
    const { inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes } = req.body;
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const result = db.prepare(`
      INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by, company_id, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, req.body.user || 'system', cid, bid);
    const updateQty = movement_type === 'in' ? quantity : -quantity;
    db.prepare(`UPDATE inventory SET quantity = quantity + ? WHERE id = ? AND company_id = ? AND branch_id = ?`).run(updateQty, inventory_id, cid, bid);

    // ACCOUNTING ENTRY: Inventory adjustment
    const adjAmount = (parseFloat(quantity) || 0) * (parseFloat(unit_cost) || 0);
    if (adjAmount > 0.001) {
      const movementId = result.lastInsertRowid;
      if (movement_type === 'in') {
        // Increase: Dr Inventory / Cr Inventory Adjustments
        postJournal({
          entry_date: new Date().toISOString().split('T')[0],
          reference_type: 'inventory_adjustment', reference_id: movementId,
          description: `تسوية مخزون (إضافة) - ${notes || ''}`.trim(),
          company_id: cid,
          lines: [
            { account_code: '1105', debit: adjAmount, credit: 0 },
            { account_code: '5300', debit: 0, credit: adjAmount }
          ]
        });
      } else {
        // Decrease: Dr Inventory Adjustments / Cr Inventory
        postJournal({
          entry_date: new Date().toISOString().split('T')[0],
          reference_type: 'inventory_adjustment', reference_id: movementId,
          description: `تسوية مخزون (خصم) - ${notes || ''}`.trim(),
          company_id: cid,
          lines: [
            { account_code: '5300', debit: adjAmount, credit: 0 },
            { account_code: '1105', debit: 0, credit: adjAmount }
          ]
        });
      }
    }

    logAudit('inventory_movements', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/inventory/:id/movements', (req, res) => {
  try {
    const movements = db.prepare(`SELECT * FROM inventory_movements WHERE inventory_id = ? AND company_id = ? AND branch_id = ? ORDER BY created_at DESC`).all(req.params.id, req.company_id, req.branch_id);
    res.json(movements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// ERP-v10: INVENTORY CONVERSION (KG → OUNCE)
// Fixed commercial ratio: 1 kg = 32 ounces
// ============================================
router.post('/inventory/convert', (req, res) => {
  try {
    const { source_inventory_id, kg_quantity } = req.body;
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const user = req.body.user || 'system';

    if (!source_inventory_id || !kg_quantity || kg_quantity <= 0) {
      return res.status(400).json({ error: 'يجب تحديد عنصر المخزون والكمية بالكيلو' });
    }

    const source = db.prepare(`
      SELECT i.*, w.branch_id FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.id = ? AND i.company_id = ? AND i.branch_id = ?
    `).get(source_inventory_id, cid, bid);

    if (!source) return res.status(404).json({ error: 'عنصر المخزون غير موجود' });
    if (source.inventory_stage !== 'retail_kg') {
      return res.status(400).json({ error: 'التحويل متاح فقط من مرحلة "تجزئة كجم" (retail_kg)' });
    }
    if (source.quantity < kg_quantity) {
      return res.status(400).json({ error: `الكمية المتاحة (${source.quantity} كجم) أقل من الكمية المطلوبة (${kg_quantity} كجم)` });
    }

    const ozQuantity = kg_quantity * KG_TO_OZ;
    const ozUnitCost = (source.unit_cost || 0) / KG_TO_OZ;
    const ozUnitPrice = (source.unit_price || 0) / KG_TO_OZ;

    // Find the retail_oz warehouse in the same branch
    const ozWarehouse = db.prepare(`
      SELECT id FROM warehouses WHERE inventory_stage = 'retail_oz' AND branch_id = ? AND company_id = ?
    `).get(source.branch_id, cid);

    if (!ozWarehouse) {
      return res.status(400).json({ error: 'لا يوجد مخزن أونصة تجزئة مرتبط بنفس الفرع' });
    }

    const txn = db.transaction(() => {
      // 1. Deduct from retail_kg source
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND company_id = ? AND branch_id = ?')
        .run(kg_quantity, source.id, cid, bid);

      // 2. Find or create retail_oz row
      let ozRow = db.prepare(`
        SELECT id, quantity FROM inventory
        WHERE warehouse_id = ? AND product_type_id = ? AND inventory_stage = 'retail_oz'
          AND COALESCE(color_code_id, 0) = COALESCE(?, 0) AND company_id = ? AND branch_id = ?
      `).get(ozWarehouse.id, source.product_type_id, source.color_code_id || null, cid, bid);

      if (ozRow) {
        db.prepare('UPDATE inventory SET quantity = quantity + ?, unit_cost = ?, unit_price = ? WHERE id = ? AND company_id = ? AND branch_id = ?')
          .run(ozQuantity, ozUnitCost, ozUnitPrice, ozRow.id, cid, bid);
      } else {
        const ins = db.prepare(`
          INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, color_description,
            master_color_id, inventory_stage, quantity, unit_cost, unit_price, company_id, branch_id)
          VALUES (?, ?, ?, ?, ?, 'retail_oz', ?, ?, ?, ?, ?)
        `).run(ozWarehouse.id, source.product_type_id, source.color_code_id || null,
               source.color_description || null, source.master_color_id || null,
               ozQuantity, ozUnitCost, ozUnitPrice, cid, bid);
        ozRow = { id: ins.lastInsertRowid, quantity: ozQuantity };
      }

      // 3. Movement records
      db.prepare(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by, company_id, branch_id)
        VALUES (?, 'out', ?, ?, 'conversion', ?, ?, ?, ?)
      `).run(source.id, kg_quantity, source.unit_cost || 0, `تحويل ${kg_quantity} كجم → ${ozQuantity} أونصة`, user, cid, bid);

      db.prepare(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by, company_id, branch_id)
        VALUES (?, 'in', ?, ?, 'conversion', ?, ?, ?, ?)
      `).run(ozRow.id, ozQuantity, ozUnitCost, `تحويل ${kg_quantity} كجم → ${ozQuantity} أونصة`, user, cid, bid);

      return { source_id: source.id, oz_id: ozRow.id, kg_deducted: kg_quantity, oz_added: ozQuantity };
    });

    const result = txn();
    logAudit('inventory', result.source_id, 'convert', { kg: kg_quantity }, { oz: result.oz_added }, user);
    res.json({ success: true, ...result, ratio: KG_TO_OZ });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
