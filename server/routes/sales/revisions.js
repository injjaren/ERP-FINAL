'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { postJournal, createJournalEntry, logAudit } = require('../../utils');
const { getFinalInvoiceVersion, adjustArtisanWorkload, computeRemaining } = require('./helpers');

// GET /api/sales/:id/revisions — list all revisions for an invoice
router.get('/sales/:id/revisions', (req, res) => {
  try {
    const cid = req.company_id;
    const saleId = parseInt(req.params.id);
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const revisions = db.prepare(`
      SELECT r.*, r.created_by
      FROM invoice_revisions r
      WHERE r.invoice_id = ? AND r.company_id = ?
      ORDER BY r.revision_number ASC
    `).all(saleId, cid);

    revisions.forEach(rev => {
      rev.items = db.prepare(`
        SELECT iri.*, st.name as service_name, a.name as artisan_name
        FROM invoice_revision_items iri
        LEFT JOIN service_types st ON iri.service_type_id = st.id AND st.company_id = iri.company_id
        LEFT JOIN artisans a ON iri.artisan_id = a.id AND a.company_id = iri.company_id
        WHERE iri.revision_id = ? AND iri.company_id = ?
      `).all(rev.id, cid);
    });

    res.json({ sale, revisions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sales/:id/final — get the latest revision items
router.get('/sales/:id/final', (req, res) => {
  try {
    const cid = req.company_id;
    const saleId = parseInt(req.params.id);
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const finalVersion = getFinalInvoiceVersion(saleId, cid);
    if (!finalVersion) {
      // No revisions yet — return the original sales_items
      const items = db.prepare(`
        SELECT si.*, st.name as service_name
        FROM sales_items si
        LEFT JOIN service_types st ON si.inventory_id = st.id AND st.company_id = si.company_id
        WHERE si.sale_id = ? AND si.company_id = ?
      `).all(saleId, cid);
      return res.json({ sale, revision: null, items });
    }
    res.json({ sale, revision: finalVersion, items: finalVersion.items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sales/:id/revision — create a new revision
// Body: { reason, created_by, items: [{service_type_id, quantity, unit_price, artisan_id, status}] }
router.post('/sales/:id/revision', (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { reason, created_by, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يجب تضمين عناصر المراجعة' });
    }

    const cid = req.company_id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    // Cannot revise a Delivered invoice — must use credit-note or adjustment
    if (sale.invoice_status === 'Delivered') {
      return res.status(400).json({
        error: 'لا يمكن تعديل فاتورة مسلّمة. استخدم إشعار الدائن أو فاتورة التسوية.',
        use: ['credit-note', 'adjustment']
      });
    }

    // Validate: no duplicate (service_type_id, artisan_id) pairs within this submission
    const pairsSeen = new Set();
    for (const item of items) {
      const pairKey = `${item.service_type_id ?? 'null'}:${item.artisan_id ?? 'null'}`;
      if (pairsSeen.has(pairKey)) {
        return res.status(400).json({
          error: `عنصر مكرر في الطلب: service_type_id=${item.service_type_id} artisan_id=${item.artisan_id}. لا يمكن تكرار نفس الخدمة والصانع في مراجعة واحدة.`
        });
      }
      pairsSeen.add(pairKey);
    }

    // Validate: all artisans referenced must be SERVICE type
    for (const item of items) {
      if (item.artisan_id) {
        const art = db.prepare(`SELECT artisan_type FROM artisans WHERE id = ? AND company_id = ?`).get(item.artisan_id, cid);
        if (!art) return res.status(400).json({ error: `الصانع رقم ${item.artisan_id} غير موجود` });
        if (art.artisan_type === 'SABRA_PACKING') {
          return res.status(400).json({ error: `لا يمكن ربط صانع سبرة/تعبئة بفاتورة خدمة. الصانع رقم ${item.artisan_id} من نوع SABRA_PACKING` });
        }
      }
    }

    const revisionTx = db.transaction(() => {
      // Determine next revision number
      const lastRev = db.prepare(`
        SELECT MAX(revision_number) as max_rev FROM invoice_revisions WHERE invoice_id = ? AND company_id = ?
      `).get(saleId, cid);
      const newRevNum = (lastRev?.max_rev || 0) + 1;

      // Get previous revision items for delta calculation
      let prevItems = [];
      if (lastRev?.max_rev) {
        const prevRev = db.prepare(`SELECT id FROM invoice_revisions WHERE invoice_id = ? AND revision_number = ? AND company_id = ?`).get(saleId, lastRev.max_rev, cid);
        if (prevRev) {
          prevItems = db.prepare(`SELECT * FROM invoice_revision_items WHERE revision_id = ? AND company_id = ?`).all(prevRev.id, cid);
        }
      } else {
        // Use original sales_items as baseline (treat service_type_id = null, artisan_id = null)
        prevItems = [];
      }

      // Create revision record
      const revResult = db.prepare(`
        INSERT INTO invoice_revisions (invoice_id, revision_number, reason, created_by, company_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(saleId, newRevNum, reason || null, created_by || 'system', cid);
      const revId = revResult.lastInsertRowid;

      const today = new Date().toISOString().split('T')[0];

      // Prepared once: fetch the latest effective artisan rate for a (artisan, service) pair.
      // Returns the row with the highest effective_from that is <= today.
      // Falls back to the baseline row (effective_from = '2000-01-01') if no dated row exists.
      const stmtFetchRate = db.prepare(`
        SELECT rate
        FROM artisan_service_rates
        WHERE artisan_id = ?
          AND service_type_id = ?
          AND effective_from <= ?
          AND company_id = ?
        ORDER BY effective_from DESC
        LIMIT 1
      `);

      // Insert new revision items and compute artisan deltas
      items.forEach(item => {
        // Fetch and freeze the artisan cost-rate at the moment of revision creation.
        // artisan_rate is the COST (what we pay the artisan).
        // unit_price is the REVENUE (what we charge the client). These are separate values.
        let frozenArtisanRate = 0;
        if (item.artisan_id && item.service_type_id) {
          const rateRow = stmtFetchRate.get(item.artisan_id, item.service_type_id, today, cid);
          frozenArtisanRate = rateRow ? parseFloat(rateRow.rate || 0) : 0;
        }

        db.prepare(`
          INSERT INTO invoice_revision_items
            (revision_id, service_type_id, quantity, unit_price, artisan_id, artisan_rate, status, notes, company_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          revId,
          item.service_type_id || null,
          item.quantity || 0,
          item.unit_price || 0,       // sale price — revenue side, unchanged
          item.artisan_id || null,
          frozenArtisanRate,          // cost rate — frozen permanently for this revision row
          item.status || 'Draft',
          item.notes || null,
          cid
        );

        // Find matching previous item (by service_type_id + artisan_id)
        const prev = prevItems.find(p =>
          p.service_type_id === item.service_type_id && p.artisan_id === item.artisan_id
        );
        const prevQty = prev ? parseFloat(prev.quantity || 0) : 0;
        const newQty  = parseFloat(item.quantity || 0);
        const deltaQty = newQty - prevQty;

        if (deltaQty !== 0) {
          // Use frozenArtisanRate (cost) for workload accounting — NOT unit_price (revenue)
          adjustArtisanWorkload(
            item.artisan_id,
            item.service_type_id,
            deltaQty,
            frozenArtisanRate,        // cost rate, not sale price
            today,
            'invoice_revision',
            revId,
            created_by || 'system',
            cid
          );
        }

        // Handle artisan change: previous artisan different from new one
        if (prev && prev.artisan_id && prev.artisan_id !== item.artisan_id) {
          // Reverse the previous artisan's workload using the rate frozen in THAT revision item
          adjustArtisanWorkload(
            prev.artisan_id,
            prev.service_type_id,
            -prevQty,
            parseFloat(prev.artisan_rate || 0),   // use the rate frozen on the previous item
            today,
            'invoice_revision',
            revId,
            created_by || 'system',
            cid
          );
        }
      });

      // Handle items that were in previous revision but NOT in new revision (removed services)
      prevItems.forEach(prev => {
        const stillPresent = items.find(i =>
          i.service_type_id === prev.service_type_id && i.artisan_id === prev.artisan_id
        );
        if (!stillPresent && prev.artisan_id) {
          // Reverse using the rate frozen on the previous revision item
          adjustArtisanWorkload(
            prev.artisan_id,
            prev.service_type_id,
            -parseFloat(prev.quantity || 0),
            parseFloat(prev.artisan_rate || 0),   // frozen rate from previous revision
            today,
            'invoice_revision',
            revId,
            created_by || 'system',
            cid
          );
        }
      });

      // Recalculate invoice total from new items
      const newSubtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);
      const discountAmt = parseFloat(sale.discount_amount || 0);
      const newFinal = Math.max(0, newSubtotal - discountAmt);

      // Update main sale record — preserve invoice_status if already set to a later stage
      // (e.g. do NOT regress Sent_To_Artisan back to In_Progress)
      const currentStatus = sale.invoice_status || 'Draft';
      const STATUS_ORDER = ['Draft','Confirmed','Sent_To_Artisan','In_Progress','Completed','Delivered','Closed'];
      const currentIdx = STATUS_ORDER.indexOf(currentStatus);
      const revisionStatus = 'In_Progress';
      const revisionIdx = STATUS_ORDER.indexOf(revisionStatus);
      // Only advance to In_Progress if current status is earlier in the lifecycle
      const nextStatus = currentIdx >= revisionIdx ? currentStatus : revisionStatus;

      db.prepare(`
        UPDATE sales SET subtotal = ?, final_amount = ?, invoice_status = ?
        WHERE id = ? AND company_id = ?
      `).run(newSubtotal, newFinal, nextStatus, saleId, cid);

      // Recompute remaining balance after final_amount changed.
      // computeRemaining() uses sales_payments SUM — deposit rows are already in there —
      // so this value correctly reflects: newFinal − all payments (including any deposits).
      // We expose this in the response so the caller can update the UI without a second request.
      const newRemaining = parseFloat(newFinal) -
        parseFloat(db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM sales_payments WHERE sale_id = ? AND company_id = ?`).get(saleId, cid).t || 0);

      // Audit
      logAudit('invoice_revisions', revId, 'create', null,
        { invoice_id: saleId, revision_number: newRevNum, reason, items },
        created_by || 'system', reason);

      return { revId, newRevNum, newSubtotal, newFinal, newRemaining };
    });

    const result = revisionTx();
    res.status(201).json({
      message: 'تم إنشاء المراجعة بنجاح',
      revision_id:       result.revId,
      revision_number:   result.newRevNum,
      new_subtotal:      result.newSubtotal,
      new_final_amount:  result.newFinal,
      remaining_balance: result.newRemaining   // final_amount − all payments (incl. deposits)
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/sales/:id/status — update invoice lifecycle status
// Body: { status, user }
// Valid statuses: Draft, Confirmed, Sent_To_Artisan, In_Progress, Completed, Delivered, Closed
router.post('/sales/:id/status', (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { status, user } = req.body;
    const VALID_STATUSES = ['Draft', 'Confirmed', 'Sent_To_Artisan', 'In_Progress', 'Completed', 'Delivered', 'Closed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `حالة غير صالحة. المسموح به: ${VALID_STATUSES.join(', ')}` });
    }
    const cid = req.company_id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const oldStatus = sale.invoice_status;

    // ── STEP 1: Lock — Confirmed cannot revert to Draft ───────────────────
    if (oldStatus === 'Confirmed' && status === 'Draft') {
      return res.status(400).json({
        error: 'Confirmed sales cannot return to Draft. Use reversal instead.'
      });
    }

    // ── STEP 2: Confirmed transition — status update + journal entry atomic ─
    if (status === 'Confirmed') {
      const confirmTx = db.transaction(() => {
        // Existing logic: update status
        db.prepare(`UPDATE sales SET invoice_status = ? WHERE id = ? AND company_id = ?`).run(status, saleId, cid);
        logAudit('sales', saleId, 'status_change',
          { invoice_status: oldStatus }, { invoice_status: status }, user || 'system');

        // Accounting: idempotency guard — only create once per sale
        const existing = db.prepare(
          "SELECT id FROM journal_entries WHERE reference_type = 'sale' AND reference_id = ? AND company_id = ?"
        ).get(saleId, cid);

        if (!existing) {
          const amount = parseFloat(sale.final_amount) || 0;
          // Dr 1104 العملاء / Cr 4100 المبيعات
          createJournalEntry({
            entry_date:     sale.date,
            reference_type: 'sale',
            reference_id:   saleId,
            description:    `Sale #${sale.invoice_number}`,
            company_id:     cid,
            lines: [
              { account_code: '1104', debit: amount, credit: 0      },
              { account_code: '4100', debit: 0,       credit: amount }
            ]
          });
        }

        // ── COGS entry (real-time) — idempotency guard ────────────────────
        const existingCogs = db.prepare(
          "SELECT id FROM journal_entries WHERE reference_type = 'sale_cogs' AND reference_id = ? AND company_id = ?"
        ).get(saleId, cid);

        if (!existingCogs) {
          // Join sale items to inventory to get unit_cost at time of confirmation
          const saleItems = db.prepare(`
            SELECT si.quantity, i.unit_cost
            FROM sales_items si
            JOIN inventory i ON i.id = si.inventory_id AND i.company_id = si.company_id
            WHERE si.sale_id = ? AND si.company_id = ? AND si.inventory_id IS NOT NULL
          `).all(saleId, cid);

          if (saleItems.length > 0) {
            const total_cogs = saleItems.reduce(
              (sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unit_cost)), 0
            );

            if (total_cogs > 0) {
              // Dr 5101 تكلفة المبيعات / Cr 1105 المخزون
              createJournalEntry({
                entry_date:     sale.date,
                reference_type: 'sale_cogs',
                reference_id:   saleId,
                description:    `COGS for Sale #${sale.invoice_number}`,
                company_id:     cid,
                lines: [
                  { account_code: '5101', debit: total_cogs, credit: 0          },
                  { account_code: '1105', debit: 0,           credit: total_cogs }
                ]
              });
            }
          }
        }
      });
      confirmTx();
    } else {
      // All other transitions — existing behaviour, completely unchanged
      db.prepare(`UPDATE sales SET invoice_status = ? WHERE id = ? AND company_id = ?`).run(status, saleId, cid);
      logAudit('sales', saleId, 'status_change',
        { invoice_status: oldStatus }, { invoice_status: status }, user || 'system');
    }

    res.json({ id: saleId, old_status: oldStatus, new_status: status });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
