'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { createJournalEntryV7, logAudit } = require('../utils');

// ============================================
// ERP-v7: BRANCHES CRUD
// Required by the transfer engine. company_id-scoped after v7 migration.
// ============================================

// ── GET /api/branches/public ─────────────────────────────────────────────────
// NO authentication required.
// Used by the login page to populate the branch dropdown before a session exists.
// Returns only id + name from the single-tenant company (company_id = 1).
router.get('/branches/public', (req, res) => {
  try {
    const branches = db.prepare(
      `SELECT id, name FROM branches WHERE company_id = 1 AND is_active = 1 ORDER BY id`
    ).all();
    res.json(branches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/branches', (req, res) => {
  try {
    const branches = db.prepare(
      `SELECT * FROM branches WHERE company_id = ? ORDER BY id`
    ).all(req.company_id);
    res.json(branches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/branches', (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ error: 'name مطلوب' });
    const result = db.prepare(
      `INSERT INTO branches (name, code, company_id) VALUES (?, ?, ?)`
    ).run(name, code || null, req.company_id);
    logAudit('branches', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, name, code: code || null });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// ERP-v7: BRANCH TRANSFERS ENGINE
// Internal commercial sale between branches.
// Every operation is wrapped in a single db.transaction().
// Isolation guard satisfied: every SQL contains company_id.
// ============================================

/**
 * Generate BT-XXXXXX transfer number, scoped to company.
 * Called inside a transaction so no race condition.
 */
function generateTransferNumber(company_id) {
  const last = db.prepare(
    `SELECT transfer_number FROM branch_transfers WHERE company_id = ? ORDER BY id DESC LIMIT 1`
  ).get(company_id);
  let next = 1;
  if (last && last.transfer_number) {
    const m = last.transfer_number.match(/BT-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `BT-${String(next).padStart(6, '0')}`;
}

// ── POST /branch-transfers ───────────────────────────────────────────────
// Body:
//   from_branch_id  INTEGER  required — selling branch
//   to_branch_id    INTEGER  required — buying branch
//   to_warehouse_id INTEGER  required — warehouse that receives goods
//   transfer_date   DATE     required — YYYY-MM-DD
//   created_by      TEXT     optional
//   items           ARRAY    required — [{ inventory_id, quantity, unit_price }]
//
// Effects (all atomic):
//   1. Decrease inventory in source (from-branch) warehouse
//   2. Find or create inventory row in to_warehouse_id
//   3. Increase inventory in destination warehouse
//   4. Record inventory_movements (OUT from source, IN to destination)
//   5. Insert branch_transfers header
//   6. Insert branch_transfer_items rows
//   7. Create JE for from_branch: DR 1104 / CR 4100
//   8. Create JE for to_branch:   DR 1105 / CR 2101
// ─────────────────────────────────────────────────────────────────────────────
router.post('/branch-transfers',(req, res) => {
  try {
    const { from_branch_id, to_branch_id, to_warehouse_id, transfer_date, items, created_by } = req.body;
    const cid = req.company_id;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!from_branch_id || !to_branch_id)
      return res.status(400).json({ error: 'from_branch_id و to_branch_id مطلوبان' });
    if (Number(from_branch_id) === Number(to_branch_id))
      return res.status(400).json({ error: 'لا يمكن التحويل من فرع إلى نفسه' });
    if (!to_warehouse_id)
      return res.status(400).json({ error: 'to_warehouse_id مطلوب (المستودع المستقبِل)' });
    if (!transfer_date)
      return res.status(400).json({ error: 'transfer_date مطلوب (YYYY-MM-DD)' });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'items مطلوب: مصفوفة من { inventory_id, quantity, unit_price }' });

    // ── Validate branches exist (company-scoped after migration) ─────────────
    const fromBranch = db.prepare(
      `SELECT id, name FROM branches WHERE id = ? AND company_id = ?`
    ).get(from_branch_id, cid);
    if (!fromBranch) return res.status(404).json({ error: `الفرع المُرسِل (id=${from_branch_id}) غير موجود` });

    const toBranch = db.prepare(
      `SELECT id, name FROM branches WHERE id = ? AND company_id = ?`
    ).get(to_branch_id, cid);
    if (!toBranch) return res.status(404).json({ error: `الفرع المستقبِل (id=${to_branch_id}) غير موجود` });

    // ── Validate destination warehouse ───────────────────────────────────────
    const toWarehouse = db.prepare(
      `SELECT id, name FROM warehouses WHERE id = ? AND company_id = ?`
    ).get(to_warehouse_id, cid);
    if (!toWarehouse) return res.status(404).json({ error: `المستودع المستقبِل (id=${to_warehouse_id}) غير موجود` });

    // ── Pre-validate all items before starting transaction ───────────────────
    for (const item of items) {
      if (!item.inventory_id || !item.quantity || !item.unit_price)
        return res.status(400).json({ error: 'كل سلعة تحتاج: inventory_id, quantity, unit_price' });
      if (parseFloat(item.quantity) <= 0)
        return res.status(400).json({ error: `الكمية يجب أن تكون أكبر من صفر (inventory_id=${item.inventory_id})` });
      if (parseFloat(item.unit_price) <= 0)
        return res.status(400).json({ error: `سعر الوحدة يجب أن يكون أكبر من صفر (inventory_id=${item.inventory_id})` });
    }

    // ── Atomic transaction ───────────────────────────────────────────────────
    const result = db.transaction(() => {

      const transfer_number = generateTransferNumber(cid);
      let total_amount = 0;
      const itemResults = [];

      // ── Process each line item ──────────────────────────────────────────────
      for (const item of items) {
        const qty       = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unit_price);
        const lineTotal = Math.round(qty * unitPrice * 10000) / 10000;
        total_amount   += lineTotal;

        // 1. Lock & read source inventory (must belong to this company)
        const srcInv = db.prepare(`
          SELECT id, quantity, unit_cost, unit_price,
                 product_type_id, color_code_id, color_description, warehouse_id
          FROM inventory
          WHERE id = ? AND company_id = ?
        `).get(item.inventory_id, cid);
        if (!srcInv) throw new Error(`المخزون id=${item.inventory_id} غير موجود أو لا ينتمي للشركة`);
        if (srcInv.quantity < qty)
          throw new Error(`كمية غير كافية في المخزون id=${item.inventory_id}: متوفر=${srcInv.quantity}, مطلوب=${qty}`);

        // 2. Decrease source inventory
        db.prepare(`
          UPDATE inventory
          SET quantity = quantity - ?
          WHERE id = ? AND company_id = ?
        `).run(qty, srcInv.id, cid);

        // 3. Record OUT movement on source
        db.prepare(`
          INSERT INTO inventory_movements
            (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by, company_id)
          VALUES (?, 'out', ?, ?, 'branch_transfer', ?, ?, ?)
        `).run(srcInv.id, qty, srcInv.unit_cost || 0,
               `تحويل داخلي إلى فرع ${toBranch.name} — ${transfer_number}`,
               created_by || 'system', cid);

        // 4. Find or create destination inventory row in to_warehouse
        const colorDesc = (srcInv.color_description || '').trim().toLowerCase();
        let destInv = db.prepare(`
          SELECT id, quantity FROM inventory
          WHERE warehouse_id = ? AND product_type_id = ? AND company_id = ?
            AND COALESCE(color_code_id, 0) = COALESCE(?, 0)
            AND LOWER(TRIM(COALESCE(color_description, ''))) = ?
        `).get(to_warehouse_id, srcInv.product_type_id, cid,
               srcInv.color_code_id || null, colorDesc);

        if (!destInv) {
          // Create a new inventory slot in the destination warehouse
          const newRow = db.prepare(`
            INSERT INTO inventory
              (warehouse_id, product_type_id, color_code_id, color_description,
               quantity, unit_cost, unit_price, company_id)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?)
          `).run(to_warehouse_id, srcInv.product_type_id,
                 srcInv.color_code_id || null, srcInv.color_description || null,
                 unitPrice, unitPrice, cid);
          destInv = { id: newRow.lastInsertRowid };
        }

        // 5. Increase destination inventory
        db.prepare(`
          UPDATE inventory
          SET quantity = quantity + ?
          WHERE id = ? AND company_id = ?
        `).run(qty, destInv.id, cid);

        // 6. Record IN movement on destination
        db.prepare(`
          INSERT INTO inventory_movements
            (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by, company_id)
          VALUES (?, 'in', ?, ?, 'branch_transfer', ?, ?, ?)
        `).run(destInv.id, qty, unitPrice,
               `تحويل داخلي من فرع ${fromBranch.name} — ${transfer_number}`,
               created_by || 'system', cid);

        itemResults.push({ srcInventoryId: srcInv.id, destInventoryId: destInv.id, qty, unitPrice, lineTotal });
      }

      // ── Insert header ───────────────────────────────────────────────────────
      const headerResult = db.prepare(`
        INSERT INTO branch_transfers
          (from_branch_id, to_branch_id, transfer_number, transfer_date, status,
           total_amount, to_warehouse_id, created_by, company_id)
        VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)
      `).run(from_branch_id, to_branch_id, transfer_number, transfer_date,
             total_amount, to_warehouse_id, created_by || 'system', cid);
      const transferId = headerResult.lastInsertRowid;

      // ── Insert line items ───────────────────────────────────────────────────
      const insertItem = db.prepare(`
        INSERT INTO branch_transfer_items
          (transfer_id, inventory_id, quantity, unit_price, total_price, company_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < items.length; i++) {
        insertItem.run(
          transferId,
          items[i].inventory_id,
          itemResults[i].qty,
          itemResults[i].unitPrice,
          itemResults[i].lineTotal,
          cid
        );
      }

      // ── Journal Entry 1: FROM branch (الجملة) ─────────────────────────────
      // DR 1104 مديونية داخلية  /  CR 4100 مبيعات داخلية
      const je1 = createJournalEntryV7({
        entry_date:     transfer_date,
        reference_type: 'branch_transfer',
        reference_id:   transferId,
        description:    `تحويل داخلي ${transfer_number} — فرع ${fromBranch.name} (مُرسِل)`,
        branch_id:      from_branch_id,
        company_id:     cid,
        lines: [
          { account_code: '1104', debit: total_amount, credit: 0 },
          { account_code: '4100', debit: 0, credit: total_amount }
        ]
      });

      // ── Journal Entry 2: TO branch (التقسيط) ──────────────────────────────
      // DR 1105 مخزون داخلي  /  CR 2101 دائنية داخلية
      const je2 = createJournalEntryV7({
        entry_date:     transfer_date,
        reference_type: 'branch_transfer',
        reference_id:   transferId,
        description:    `تحويل داخلي ${transfer_number} — فرع ${toBranch.name} (مستقبِل)`,
        branch_id:      to_branch_id,
        company_id:     cid,
        lines: [
          { account_code: '1105', debit: total_amount, credit: 0 },
          { account_code: '2101', debit: 0, credit: total_amount }
        ]
      });

      // Audit log
      logAudit('branch_transfers', transferId, 'create', null, {
        transfer_number, from_branch_id, to_branch_id, to_warehouse_id,
        transfer_date, total_amount, item_count: items.length,
        je_from: je1.entry_number, je_to: je2.entry_number
      }, created_by || 'system');

      return {
        id:              transferId,
        transfer_number,
        from_branch:     fromBranch.name,
        to_branch:       toBranch.name,
        to_warehouse:    toWarehouse.name,
        transfer_date,
        status:          'confirmed',
        total_amount,
        item_count:      items.length,
        journal_entries: {
          from_branch: { id: je1.id, number: je1.entry_number, debit: '1104', credit: '4100' },
          to_branch:   { id: je2.id, number: je2.entry_number, debit: '1105', credit: '2101' }
        }
      };
    })();

    res.status(201).json(result);
  } catch (err) {
    console.error('[v7-TRANSFER ERROR]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── GET /branch-transfers ────────────────────────────────────────────────
// Returns all branch transfers for the current company, newest first.
router.get('/branch-transfers',(req, res) => {
  try {
    const cid = req.company_id;
    const transfers = db.prepare(`
      SELECT
        bt.*,
        fb.name AS from_branch_name,
        tb.name AS to_branch_name,
        w.name  AS to_warehouse_name
      FROM branch_transfers bt
      LEFT JOIN branches  fb ON bt.from_branch_id  = fb.id AND fb.company_id = bt.company_id
      LEFT JOIN branches  tb ON bt.to_branch_id    = tb.id AND tb.company_id = bt.company_id
      LEFT JOIN warehouses w ON bt.to_warehouse_id = w.id  AND w.company_id  = bt.company_id
      WHERE bt.company_id = ?
      ORDER BY bt.id DESC
    `).all(cid);
    res.json(transfers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /branch-transfers/:id ───────────────────────────────────────────
// Returns a single transfer with its line items.
router.get('/branch-transfers/:id', (req, res) => {
  try {
    const cid = req.company_id;

    const transfer = db.prepare(`
      SELECT
        bt.*,
        fb.name AS from_branch_name,
        tb.name AS to_branch_name,
        w.name  AS to_warehouse_name
      FROM branch_transfers bt
      LEFT JOIN branches  fb ON bt.from_branch_id  = fb.id AND fb.company_id = bt.company_id
      LEFT JOIN branches  tb ON bt.to_branch_id    = tb.id AND tb.company_id = bt.company_id
      LEFT JOIN warehouses w ON bt.to_warehouse_id = w.id  AND w.company_id  = bt.company_id
      WHERE bt.id = ? AND bt.company_id = ?
    `).get(req.params.id, cid);
    if (!transfer) return res.status(404).json({ error: 'التحويل غير موجود' });

    const transferItems = db.prepare(`
      SELECT
        bti.*,
        pt.name     AS product_name,
        pt.unit     AS unit,
        cc.code     AS color_code,
        w2.name     AS source_warehouse_name
      FROM branch_transfer_items bti
      LEFT JOIN inventory    inv ON bti.inventory_id    = inv.id
      LEFT JOIN product_types pt ON inv.product_type_id = pt.id
      LEFT JOIN color_codes   cc ON inv.color_code_id   = cc.id
      LEFT JOIN warehouses    w2 ON inv.warehouse_id    = w2.id
      WHERE bti.transfer_id = ? AND bti.company_id = ?
      ORDER BY bti.id
    `).all(req.params.id, cid);

    const journalEntries = db.prepare(`
      SELECT je.id, je.entry_number, je.entry_date, je.description, je.branch_id, je.company_id
      FROM journal_entries je
      WHERE je.reference_type = 'branch_transfer'
        AND je.reference_id   = ?
        AND je.company_id     = ?
      ORDER BY je.id
    `).all(req.params.id, cid);

    res.json({ ...transfer, items: transferItems, journal_entries: journalEntries });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
