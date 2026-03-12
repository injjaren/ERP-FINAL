'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { addTreasuryEntry, postJournal, createJournalEntry, logAudit } = require('../../utils');
const { adjustArtisanWorkload, computeRemaining } = require('./helpers');

// POST /api/sales/:id/credit-note — create a credit note for a Delivered invoice
// Body: { reason, created_by, items: [{service_type_id, quantity, unit_price, artisan_id}], payments? }
router.post('/sales/:id/credit-note', (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { reason, created_by, items, payments } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يجب تضمين عناصر إشعار الدائن' });
    }

    const cid = req.company_id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const creditTx = db.transaction(() => {
      const today = new Date().toISOString().split('T')[0];

      // Calculate credit note totals (negative amounts)
      const creditSubtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);

      // Generate credit note invoice number
      const origNum = sale.invoice_number;
      const creditNum = `CN-${origNum}-${Date.now()}`;

      // Create credit note as a new sale record with negative final_amount
      const creditResult = db.prepare(`
        INSERT INTO sales (invoice_number, date, client_id, client_name, client_phone,
                           subtotal, discount_percent, discount_amount, final_amount,
                           status, invoice_status, notes, created_by, company_id)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'credit_note', 'Closed', ?, ?, ?)
      `).run(
        creditNum, today,
        sale.client_id, sale.client_name, sale.client_phone,
        -creditSubtotal, -creditSubtotal,
        `إشعار دائن للفاتورة ${origNum}: ${reason || ''}`,
        created_by || 'system', cid
      );
      const creditSaleId = creditResult.lastInsertRowid;

      // Insert credit note items (negative quantities)
      items.forEach(item => {
        db.prepare(`
          INSERT INTO sales_items (sale_id, inventory_id, product_name, quantity, unit_price, total_price, company_id)
          VALUES (?, NULL, ?, ?, ?, ?, ?)
        `).run(
          creditSaleId,
          item.service_name || `خدمة ${item.service_type_id || ''}`,
          -Math.abs(parseFloat(item.quantity || 0)),
          parseFloat(item.unit_price || 0),
          -(Math.abs(parseFloat(item.quantity || 0)) * parseFloat(item.unit_price || 0)),
          cid
        );

        // Reverse artisan workload (SERVICE artisans only)
        if (item.artisan_id) {
          adjustArtisanWorkload(
            item.artisan_id,
            item.service_type_id,
            -Math.abs(parseFloat(item.quantity || 0)),
            parseFloat(item.unit_price || 0),
            today,
            'credit_note',
            creditSaleId,
            created_by || 'system',
            cid
          );
        }
      });

      // Link credit note to original via a revision entry
      const lastRev = db.prepare(`SELECT MAX(revision_number) as max_rev FROM invoice_revisions WHERE invoice_id = ? AND company_id = ?`).get(saleId, cid);
      const nextRevNum = (lastRev?.max_rev || 0) + 1;
      db.prepare(`
        INSERT INTO invoice_revisions (invoice_id, revision_number, reason, created_by, company_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(saleId, nextRevNum, `إشعار دائن: ${creditNum} - ${reason || ''}`, created_by || 'system', cid);

      // If client debt was created, reduce it back
      if (sale.client_id && creditSubtotal > 0) {
        db.prepare(`UPDATE clients SET balance = balance - ? WHERE id = ? AND company_id = ? AND balance >= ?`)
          .run(creditSubtotal, sale.client_id, cid, creditSubtotal);
      }

      logAudit('sales', creditSaleId, 'credit_note', null, {
        original_sale_id: saleId, reason, items
      }, created_by || 'system', reason);

      return { creditSaleId, creditNum, creditSubtotal };
    });

    const result = creditTx();
    res.status(201).json({
      message: 'تم إنشاء إشعار الدائن بنجاح',
      credit_note_id: result.creditSaleId,
      credit_note_number: result.creditNum,
      credit_amount: result.creditSubtotal
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/sales/:id/adjustment — create an adjustment (additional) sale linked to original
// Body: { reason, created_by, items: [{service_type_id, service_name, quantity, unit_price, artisan_id}], payments? }
router.post('/sales/:id/adjustment', (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { reason, created_by, items, payments } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يجب تضمين عناصر فاتورة التسوية' });
    }

    const cid = req.company_id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    // Validate: all artisans must be SERVICE type
    for (const item of items) {
      if (item.artisan_id) {
        const art = db.prepare(`SELECT artisan_type FROM artisans WHERE id = ? AND company_id = ?`).get(item.artisan_id, cid);
        if (!art) return res.status(400).json({ error: `الصانع رقم ${item.artisan_id} غير موجود` });
        if (art.artisan_type === 'SABRA_PACKING') {
          return res.status(400).json({ error: `لا يمكن ربط صانع سبرة بفاتورة خدمة. الصانع رقم ${item.artisan_id}` });
        }
      }
    }

    const adjTx = db.transaction(() => {
      const today = new Date().toISOString().split('T')[0];
      const adjSubtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);
      const adjNum = `ADJ-${sale.invoice_number}-${Date.now()}`;

      // Create adjustment as new positive sale
      const adjResult = db.prepare(`
        INSERT INTO sales (invoice_number, date, client_id, client_name, client_phone,
                           subtotal, discount_percent, discount_amount, final_amount,
                           status, invoice_status, notes, created_by, company_id)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'adjustment', 'Closed', ?, ?, ?)
      `).run(
        adjNum, today,
        sale.client_id, sale.client_name, sale.client_phone,
        adjSubtotal, adjSubtotal,
        `تسوية للفاتورة ${sale.invoice_number}: ${reason || ''}`,
        created_by || 'system', cid
      );
      const adjSaleId = adjResult.lastInsertRowid;

      // Insert adjustment items
      items.forEach(item => {
        db.prepare(`
          INSERT INTO sales_items (sale_id, inventory_id, product_name, quantity, unit_price, total_price, company_id)
          VALUES (?, NULL, ?, ?, ?, ?, ?)
        `).run(
          adjSaleId,
          item.service_name || `خدمة ${item.service_type_id || ''}`,
          parseFloat(item.quantity || 0),
          parseFloat(item.unit_price || 0),
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0),
          cid
        );

        // Add to artisan workload
        if (item.artisan_id) {
          adjustArtisanWorkload(
            item.artisan_id,
            item.service_type_id,
            parseFloat(item.quantity || 0),
            parseFloat(item.unit_price || 0),
            today,
            'adjustment',
            adjSaleId,
            created_by || 'system',
            cid
          );
        }
      });

      // Process payments if provided
      if (payments && Array.isArray(payments)) {
        payments.forEach(p => {
          db.prepare(`INSERT INTO sales_payments (sale_id, payment_type, amount, check_number, check_date, check_due_date, bank, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(adjSaleId, p.payment_type, p.amount, p.check_number || null, p.check_date || null, p.check_due_date || null, p.bank || null, cid);
          if (p.payment_type === 'نقدي') {
            addTreasuryEntry(today, 'وارد', `تسوية - ${adjNum}`, p.amount, 'الصندوق', 'sale', adjSaleId, created_by, cid);
          }
          if (p.payment_type === 'تحويل') {
            addTreasuryEntry(today, 'وارد', `تسوية (تحويل) - ${adjNum}`, p.amount, 'البنك', 'sale', adjSaleId, created_by, cid);
          }
          if (p.payment_type === 'آجل' && sale.client_id) {
            db.prepare('UPDATE clients SET balance = balance + ? WHERE id = ? AND company_id = ?').run(p.amount, sale.client_id, cid);
          }
        });
      }

      // Link to original via revision entry
      const lastRev = db.prepare(`SELECT MAX(revision_number) as max_rev FROM invoice_revisions WHERE invoice_id = ? AND company_id = ?`).get(saleId, cid);
      const nextRevNum = (lastRev?.max_rev || 0) + 1;
      db.prepare(`
        INSERT INTO invoice_revisions (invoice_id, revision_number, reason, created_by, company_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(saleId, nextRevNum, `تسوية: ${adjNum} - ${reason || ''}`, created_by || 'system', cid);

      logAudit('sales', adjSaleId, 'adjustment', null, {
        original_sale_id: saleId, reason, items
      }, created_by || 'system', reason);

      return { adjSaleId, adjNum, adjSubtotal };
    });

    const result = adjTx();
    res.status(201).json({
      message: 'تم إنشاء فاتورة التسوية بنجاح',
      adjustment_id: result.adjSaleId,
      adjustment_number: result.adjNum,
      adjustment_amount: result.adjSubtotal
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});


// ============================================
// DEPOSIT (ARABOUN) ENDPOINT
// ============================================

// POST /api/sales/:id/deposit
// Records an Araboun (deposit) payment against an invoice.
// Body: { amount, payment_type, date, check_number?, check_date?, check_due_date?, bank?, user }
// Rules:
//   - Deposit stored as payment_type = 'أرابون' in sales_payments
//   - Updates sales.deposit_amount (running total of all deposits on this invoice)
//   - Creates matching treasury entry (cash or bank)
//   - Does NOT duplicate: each call adds ONE payment row; idempotency is caller's responsibility
//   - Does NOT allow deposit > final_amount
router.post('/sales/:id/deposit', (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { amount, payment_type, date, check_number, check_date, check_due_date, bank, user } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'مبلغ العربون يجب أن يكون أكبر من الصفر' });
    }

    const depositAmt = parseFloat(amount);

    const cid = req.company_id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
    if (!sale) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    // Guard: deposit must not exceed current remaining balance
    const currentRemaining = computeRemaining(saleId, cid);
    if (depositAmt > currentRemaining + 0.001) {   // 0.001 tolerance for float rounding
      return res.status(400).json({
        error: `مبلغ العربون (${depositAmt}) يتجاوز الرصيد المتبقي (${currentRemaining.toFixed(2)})`,
        remaining: currentRemaining
      });
    }

    const depositTx = db.transaction(() => {
      const payDate = date || new Date().toISOString().split('T')[0];

      // 1. Insert payment row — type is always 'أرابون' regardless of cash/check/transfer
      //    We store the actual payment method alongside so treasury routing works correctly.
      const payResult = db.prepare(`
        INSERT INTO sales_payments
          (sale_id, payment_type, amount, check_number, check_date, check_due_date, bank, company_id)
        VALUES (?, 'أرابون', ?, ?, ?, ?, ?, ?)
      `).run(saleId, depositAmt, check_number || null, check_date || null, check_due_date || null, bank || null, cid);
      const payId = payResult.lastInsertRowid;

      // 2. Update sales.deposit_amount (cumulative sum of all deposits)
      db.prepare(`UPDATE sales SET deposit_amount = COALESCE(deposit_amount, 0) + ? WHERE id = ? AND company_id = ?`)
        .run(depositAmt, saleId, cid);

      // 3. Treasury entry — route by actual payment method supplied by caller
      const invoiceNum = sale.invoice_number;
      const effectiveMethod = (payment_type || 'نقدي');
      if (effectiveMethod === 'نقدي') {
        addTreasuryEntry(payDate, 'وارد',
          `عربون - فاتورة ${invoiceNum}`,
          depositAmt, 'الصندوق', 'sale_deposit', saleId, user || 'system', cid);
      } else if (effectiveMethod === 'تحويل' || effectiveMethod === 'TPE') {
        addTreasuryEntry(payDate, 'وارد',
          `عربون (${effectiveMethod}) - فاتورة ${invoiceNum}`,
          depositAmt, 'البنك', 'sale_deposit', saleId, user || 'system', cid);
      } else if (effectiveMethod === 'شيك') {
        // Add to checks portfolio for collection
        db.prepare(`
          INSERT INTO checks_portfolio
            (check_number, date, from_client, amount, due_date, bank, status, source, company_id)
          VALUES (?, ?, ?, ?, ?, ?, 'معلق', 'عربون', ?)
        `).run(check_number, payDate, sale.client_name || 'عميل عابر',
               depositAmt, check_due_date, bank, cid);
      }

      // 4. Audit
      logAudit('sales_payments', payId, 'deposit',
        null,
        { sale_id: saleId, amount: depositAmt, payment_type: effectiveMethod },
        user || 'system');

      // 5. Payment journal entry — Debit cash/bank/checks account, Credit 1104 Customers
      //    Account mapping: نقدي → 1101 (الصندوق), شيك → 1103 (محفظة الشيكات),
      //                     تحويل / تحويل بنكي / TPE → 1102 (البنك)
      const debitAccount =
        effectiveMethod === 'نقدي' ? '1101' :
        effectiveMethod === 'شيك' ? '1103' :
        /* تحويل, تحويل بنكي, TPE */  '1102';

      createJournalEntry({
        entry_date:     payDate,
        reference_type: 'sale_payment',
        reference_id:   payId,
        description:    `دفعة عربون - فاتورة ${invoiceNum}`,
        company_id:     cid,
        lines: [
          { account_code: debitAccount, debit: depositAmt, credit: 0           },
          { account_code: '1104',       debit: 0,           credit: depositAmt }
        ]
      });

      // 6. Return fresh remaining
      const newRemaining = computeRemaining(saleId, cid);
      return { payId, newRemaining };
    });

    const result = depositTx();
    res.status(201).json({
      message: 'تم تسجيل العربون بنجاح',
      payment_id:       result.payId,
      deposit_amount:   depositAmt,
      remaining_balance: result.newRemaining
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
