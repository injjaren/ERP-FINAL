'use strict';
const { db } = require('../../database');

// Helper: get the latest revision for an invoice
function getFinalInvoiceVersion(invoiceId, company_id) {
  const cid = company_id || 1;
  const rev = db.prepare(`
    SELECT r.*, MAX(r.revision_number) as rev_num
    FROM invoice_revisions r
    WHERE r.invoice_id = ? AND r.company_id = ?
    GROUP BY r.invoice_id
  `).get(invoiceId, cid);
  if (!rev) return null;
  const items = db.prepare(`
    SELECT iri.*, st.name as service_name, a.name as artisan_name
    FROM invoice_revision_items iri
    LEFT JOIN service_types st ON iri.service_type_id = st.id
    LEFT JOIN artisans a ON iri.artisan_id = a.id
    WHERE iri.revision_id = ? AND iri.company_id = ?
  `).all(rev.id, cid);
  return { ...rev, items };
}

// Helper: apply artisan workload delta (SERVICE artisans only)
function adjustArtisanWorkload(artisanId, serviceTypeId, deltaQty, unitPrice, date, refType, refId, user, company_id) {
  if (!artisanId) return;
  const cid = company_id || 1;
  // Verify this is a SERVICE artisan
  const artisan = db.prepare(`SELECT artisan_type FROM artisans WHERE id = ? AND company_id = ?`).get(artisanId, cid);
  if (!artisan || artisan.artisan_type === 'SABRA_PACKING') return;

  const amount = Math.abs(deltaQty * (unitPrice || 0));
  if (amount === 0) return;

  if (deltaQty > 0) {
    // Increase: debit (earn) on artisan account
    db.prepare(`
      INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id, company_id)
      VALUES (?, ?, 'debit', ?, ?, ?, ?, ?)
    `).run(artisanId, date, amount, `إضافة خدمة - مراجعة فاتورة`, refType, refId, cid);
    db.prepare(`UPDATE artisans SET account_balance = account_balance + ? WHERE id = ? AND company_id = ?`).run(amount, artisanId, cid);
  } else {
    // Decrease: credit (reduce owed) on artisan account
    db.prepare(`
      INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id, company_id)
      VALUES (?, ?, 'credit', ?, ?, ?, ?, ?)
    `).run(artisanId, date, amount, `تخفيض خدمة - مراجعة فاتورة`, refType, refId, cid);
    db.prepare(`UPDATE artisans SET account_balance = account_balance - ? WHERE id = ? AND company_id = ?`).run(amount, artisanId, cid);
  }
}

// Helper: compute remaining balance for a sale.
// remaining = final_amount − SUM(all payments including deposit)
// The deposit row is already inside sales_payments as payment_type='أرابون',
// so this is just final_amount - total_paid.  Exposed as a helper so both
// the deposit endpoint and the revision endpoint share one source of truth.
function computeRemaining(saleId, company_id) {
  const cid = company_id || 1;
  const sale   = db.prepare('SELECT final_amount FROM sales WHERE id = ? AND company_id = ?').get(saleId, cid);
  if (!sale) return null;
  const paid   = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM sales_payments WHERE sale_id = ? AND company_id = ?`).get(saleId, cid);
  return parseFloat(sale.final_amount || 0) - parseFloat(paid.total || 0);
}

module.exports = { getFinalInvoiceVersion, adjustArtisanWorkload, computeRemaining };
