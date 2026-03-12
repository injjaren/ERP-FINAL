'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { logAudit, addTreasuryEntry, VALID_STAGES } = require('../utils');

// ============================================
// DASHBOARD
// ============================================

router.get('/dashboard', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const ob = db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(cid, bid);
    const ledger = db.prepare('SELECT * FROM treasury_ledger WHERE company_id = ? AND branch_id = ?').all(cid, bid);
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0 AND company_id = ? AND branch_id = ?`).get(cid, bid);
    let cash = parseFloat(ob?.cash || 0), bank = parseFloat(ob?.bank || 0);
    ledger.forEach(t => { const amt = parseFloat(t.amount || 0); if (t.type === 'وارد') { if (t.account === 'الصندوق') cash += amt; else bank += amt; } else { if (t.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    const checksUnderCollection = parseFloat(checksPortfolio?.total || 0);
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const salesData = db.prepare('SELECT SUM(subtotal) as subtotal, SUM(discount_amount) as discounts, SUM(final_amount) as net FROM sales WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const expenses = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory WHERE company_id = ? AND branch_id = ?').get(cid, bid);

    // COGS from sale_items: actual cost of goods sold (unit_cost * quantity per line)
    const cogsData = db.prepare('SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) as total FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.company_id = ? AND s.branch_id = ?').get(cid, bid);

    // ── Inventory stage breakdown ────────────────────────────────────────────
    const stageRows = db.prepare(`
      SELECT inventory_stage, ROUND(SUM(quantity), 3) AS total_qty
      FROM inventory
      WHERE company_id = ? AND branch_id = ?
      GROUP BY inventory_stage
    `).all(cid, bid);
    const stageMap = {};
    stageRows.forEach(r => { stageMap[r.inventory_stage] = r.total_qty || 0; });

    // Low-stock count: kg-based stages with 0 < quantity < 5
    const LOW_STOCK_KG = 5;
    const lowStockCount = db.prepare(`
      SELECT COUNT(*) AS cnt FROM inventory
      WHERE company_id = ? AND branch_id = ?
        AND inventory_stage IN ('wholesale_kg','retail_kg')
        AND quantity > 0 AND quantity < ?
    `).get(cid, bid, LOW_STOCK_KG)?.cnt || 0;

    // Top 5 colors by quantity in wholesale_kg (most stocked)
    const topColors = db.prepare(`
      SELECT
        COALESCE(mc.color_code, cc.main_color, i.color_description, 'بدون') AS color_name,
        COALESCE(mc.hex_code, '') AS hex_code,
        ROUND(SUM(i.quantity), 2) AS total_kg
      FROM inventory i
      LEFT JOIN color_codes   cc ON cc.id = i.color_code_id  AND cc.company_id = i.company_id
      LEFT JOIN master_colors mc ON mc.id = i.master_color_id AND mc.company_id = i.company_id
      WHERE i.company_id = ? AND i.branch_id = ? AND i.inventory_stage = 'wholesale_kg' AND i.quantity > 0
      GROUP BY COALESCE(mc.color_code, cc.main_color, i.color_description, 'بدون'),
               COALESCE(mc.hex_code, '')
      ORDER BY total_kg DESC
      LIMIT 5
    `).all(cid, bid);

    const grossSales = parseFloat(salesData?.subtotal || 0), salesDiscounts = parseFloat(salesData?.discounts || 0), netSales = parseFloat(salesData?.net || 0);
    const totalCOGS = parseFloat(cogsData?.total || 0);
    const totalExpenses = parseFloat(expenses?.total || 0);
    const netProfit = netSales - totalCOGS - totalExpenses;

    res.json({
      cash, bank, checksUnderCollection, totalLiquid: cash + bank + checksUnderCollection,
      inventoryValue: parseFloat(inventory?.total || 0),
      clientsDebt: parseFloat(clients?.total || 0), suppliersDebt: parseFloat(suppliers?.total || 0),
      grossSales, salesDiscounts, netSales, totalCOGS, totalExpenses, netProfit,
      // inventory stage breakdown
      inventory: {
        wholesale_kg:  stageMap['wholesale_kg']  || 0,
        retail_kg:     stageMap['retail_kg']     || 0,
        retail_oz:     stageMap['retail_oz']     || 0,
        raw_bobbin:    stageMap['raw_bobbin']    || 0,
        low_stock_count: lowStockCount,
        top_colors: topColors
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// REPORTS
// ============================================

router.get('/reports/balance-sheet', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { year } = req.query;
    const ob = db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(cid, bid) || { cash: 0, bank: 0 };
    const ledger = db.prepare('SELECT * FROM treasury_ledger WHERE company_id = ? AND branch_id = ?').all(cid, bid);
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0 AND company_id = ? AND branch_id = ?`).get(cid, bid);
    let cash = parseFloat(ob.cash || 0), bank = parseFloat(ob.bank || 0);
    ledger.forEach(t => { const amt = parseFloat(t.amount || 0); if (t.type === 'وارد') { if (t.account === 'الصندوق') cash += amt; else bank += amt; } else { if (t.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const partners = db.prepare('SELECT SUM(initial_capital) as total FROM partners WHERE company_id = ?').get(cid);
    const assets = { cash, bank, checks: parseFloat(checksPortfolio?.total || 0), inventory: parseFloat(inventory?.total || 0), clientsDebt: parseFloat(clients?.total || 0), total: cash + bank + parseFloat(checksPortfolio?.total || 0) + parseFloat(inventory?.total || 0) + parseFloat(clients?.total || 0) };
    const liabilities = { suppliersDebt: parseFloat(suppliers?.total || 0), total: parseFloat(suppliers?.total || 0) };
    const equity = { capital: parseFloat(partners?.total || 0), total: parseFloat(partners?.total || 0) };
    res.json({ assets, liabilities, equity, year: year || new Date().getFullYear() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/income-statement', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { year } = req.query;

    // Revenue — exclude credit_note and adjustment rows from gross revenue,
    // but include them in net (they carry negative final_amount which naturally offsets)
    const salesData = db.prepare(`
      SELECT
        SUM(CASE WHEN status NOT IN ('credit_note','adjustment') THEN subtotal      ELSE 0 END) as gross,
        SUM(CASE WHEN status NOT IN ('credit_note','adjustment') THEN discount_amount ELSE 0 END) as discounts,
        SUM(final_amount) as net
      FROM sales
      WHERE company_id = ? AND branch_id = ?
    `).get(cid, bid) || { gross: 0, discounts: 0, net: 0 };

    const purchases    = db.prepare('SELECT SUM(total_amount) as total FROM purchases WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const expenses     = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE company_id = ? AND branch_id = ?').get(cid, bid);
    const manufacturing = db.prepare(`SELECT SUM(total_cost) as total FROM manufacturing_orders WHERE status = 'مكتمل' AND company_id = ? AND branch_id = ?`).get(cid, bid);

    // Service labour cost: SUM(quantity × artisan_rate) from the LATEST revision of each sale.
    // artisan_rate is the frozen cost-rate stored at revision-creation time — NOT unit_price.
    // unit_price is the sale price (revenue side) and must never be used here.
    // Correlated subquery picks the single highest revision_number per invoice.
    // Only items with artisan_id (service lines). Excludes credit_note / adjustment rows.
    const serviceLaborData = db.prepare(`
      SELECT COALESCE(SUM(iri.quantity * iri.artisan_rate), 0) as total
      FROM invoice_revision_items iri
      JOIN invoice_revisions ir ON iri.revision_id = ir.id AND ir.company_id = iri.company_id
      JOIN sales s ON ir.invoice_id = s.id AND s.company_id = ir.company_id
      WHERE iri.artisan_id IS NOT NULL
        AND iri.company_id = ?
        AND s.branch_id = ?
        AND s.status NOT IN ('credit_note', 'adjustment')
        AND ir.revision_number = (
          SELECT MAX(r2.revision_number)
          FROM invoice_revisions r2
          WHERE r2.invoice_id = ir.invoice_id
        )
    `).get(cid, bid);

    const grossSales       = parseFloat(salesData?.gross        || 0);
    const salesDiscounts   = parseFloat(salesData?.discounts    || 0);
    const netSales         = parseFloat(salesData?.net          || 0);
    const purchasesCost    = parseFloat(purchases?.total        || 0);
    const manufacturingCost= parseFloat(manufacturing?.total    || 0);
    const serviceLaborCost = parseFloat(serviceLaborData?.total || 0);
    const operatingExpenses= parseFloat(expenses?.total         || 0);

    const costOfGoods  = purchasesCost + manufacturingCost + serviceLaborCost;
    const grossProfit  = netSales - costOfGoods;
    const netProfit    = grossProfit - operatingExpenses;

    res.json({
      revenue: {
        gross_sales:           grossSales,
        less_sales_discounts:  salesDiscounts,
        net_sales:             netSales,
        total:                 netSales
      },
      cost_of_goods: {
        purchases:      purchasesCost,
        manufacturing:  manufacturingCost,
        service_labor:  serviceLaborCost,   // NEW: artisan service cost from latest revisions
        total:          costOfGoods
      },
      gross_profit:  grossProfit,
      expenses: {
        operating: operatingExpenses,
        total:     operatingExpenses
      },
      net_profit: netProfit,
      year: year || new Date().getFullYear()
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reports/distribute-profit', (req, res) => {
  try {
    const cid = req.company_id;
    const { fiscal_year, net_profit } = req.body;
    const partners = db.prepare('SELECT * FROM partners WHERE active = 1 AND company_id = ?').all(cid);
    const distributions = [];
    partners.forEach(partner => {
      const share_amount = net_profit * (partner.share_percent / 100);
      db.prepare(`INSERT INTO profit_distributions (fiscal_year, partner_id, net_profit, share_percent, share_amount, company_id) VALUES (?, ?, ?, ?, ?, ?)`).run(fiscal_year, partner.id, net_profit, partner.share_percent, share_amount, cid);
      distributions.push({ partner_id: partner.id, partner_name: partner.name, share_percent: partner.share_percent, share_amount });
    });
    res.json({ fiscal_year, net_profit, distributions });
  } catch (err) { res.status(400).json({ error: err.message }); }
});


// API for product images (categories with products)
router.get('/inventory/by-category', (req, res) => {
  try {
    const { stage } = req.query;
    let stageFilter = '';
    const params = [req.company_id, req.branch_id || 1];
    if (stage && VALID_STAGES.includes(stage)) { stageFilter = 'AND i.inventory_stage = ?'; params.push(stage); }
    const inventory = db.prepare(`
      SELECT i.*,
             w.name  AS warehouse_name,
             pt.name AS product_name, pt.category, pt.unit,
             cc.code AS color_code, cc.main_color, cc.shade,
             mc.color_code   AS mc_color_code,
             mc.color_family AS color_family,
             mc.shade_name   AS shade_name,
             mc.hex_code     AS hex_code
      FROM inventory i
      LEFT JOIN warehouses    w  ON i.warehouse_id    = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes   cc ON i.color_code_id   = cc.id
      LEFT JOIN master_colors mc ON i.master_color_id = mc.id
      WHERE i.quantity > 0
        AND i.company_id = ? AND i.branch_id = ?
        ${stageFilter}
      ORDER BY pt.category, pt.name, cc.code
    `).all(...params);

    // Group by category
    const categories = {};
    inventory.forEach(item => {
      const cat = item.category || 'غير مصنف';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    });

    res.json({ inventory, categories });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/inventory-valuation', (req, res) => {
  try {
    const valuation = db.prepare(`
      SELECT
        i.id, i.warehouse_id, i.product_type_id, i.color_code_id, i.master_color_id,
        w.name  AS warehouse_name,
        pt.name AS product_name,
        cc.code AS color_code,
        mc.color_code   AS mc_color_code,
        mc.color_family AS color_family,
        mc.shade_name   AS shade_name,
        mc.hex_code     AS hex_code,
        i.quantity AS snapshot_quantity,
        SUM(CASE WHEN im.movement_type = 'in'  THEN  im.quantity
                 WHEN im.movement_type = 'out' THEN -im.quantity END) AS actual_quantity,
        AVG(CASE WHEN im.movement_type = 'in'  THEN  im.unit_cost  END) AS avg_cost
      FROM inventory i
      LEFT JOIN inventory_movements im ON i.id             = im.inventory_id
      LEFT JOIN warehouses          w  ON i.warehouse_id   = w.id
      LEFT JOIN product_types       pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes         cc ON i.color_code_id  = cc.id
      LEFT JOIN master_colors       mc ON i.master_color_id = mc.id
      WHERE i.company_id = ? AND i.branch_id = ?
      GROUP BY i.id
    `).all(req.company_id, req.branch_id || 1);
    const total_value = valuation.reduce((sum, item) => sum + (parseFloat(item.actual_quantity || 0) * parseFloat(item.avg_cost || 0)), 0);
    res.json({ valuation, total_value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// WHOLESALE REPORTS
// GET /api/reports/customer-balances — clients with balance > 0
// GET /api/reports/daily-sales?from=&to= — sales grouped by date
// ============================================================

// ============================================================
// INVENTORY REPORTS
// GET /api/reports/inventory-summary — stage totals, low stock, recent movements
// ============================================================
router.get('/reports/inventory-summary', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;

    // Stage totals with value
    const stageRows = db.prepare(`
      SELECT
        i.inventory_stage,
        ROUND(SUM(i.quantity), 3)                       AS total_qty,
        ROUND(SUM(i.quantity * i.unit_cost), 2)         AS total_value,
        COUNT(DISTINCT i.id)                             AS item_count
      FROM inventory i
      WHERE i.company_id = ? AND i.branch_id = ?
      GROUP BY i.inventory_stage
    `).all(cid, bid);

    // Low stock items (kg stages, 0 < qty < 10)
    const LOW = 10;
    const lowStock = db.prepare(`
      SELECT
        i.id, i.inventory_stage, ROUND(i.quantity, 3) AS quantity,
        w.name AS warehouse_name, pt.name AS product_name,
        COALESCE(cc.main_color, i.color_description, 'بدون') AS color_name,
        COALESCE(cc.code, '') AS color_code
      FROM inventory i
      LEFT JOIN warehouses    w  ON w.id  = i.warehouse_id
      LEFT JOIN product_types pt ON pt.id = i.product_type_id
      LEFT JOIN color_codes   cc ON cc.id = i.color_code_id AND cc.company_id = i.company_id
      WHERE i.company_id = ? AND i.branch_id = ?
        AND i.inventory_stage IN ('wholesale_kg','retail_kg')
        AND i.quantity > 0 AND i.quantity < ?
      ORDER BY i.quantity ASC
      LIMIT 20
    `).all(cid, bid, LOW);

    // Recent inventory movements (last 30)
    const recentMovements = db.prepare(`
      SELECT
        im.id, im.movement_type, ROUND(im.quantity, 3) AS quantity,
        im.reference_type, im.notes, DATE(im.created_at) AS movement_date,
        i.inventory_stage,
        w.name AS warehouse_name,
        COALESCE(cc.main_color, i.color_description, pt.name, 'بدون') AS item_name
      FROM inventory_movements im
      JOIN inventory i ON i.id = im.inventory_id AND i.company_id = im.company_id
      LEFT JOIN warehouses    w  ON w.id  = i.warehouse_id
      LEFT JOIN product_types pt ON pt.id = i.product_type_id
      LEFT JOIN color_codes   cc ON cc.id = i.color_code_id AND cc.company_id = i.company_id
      WHERE im.company_id = ? AND im.branch_id = ?
      ORDER BY im.created_at DESC
      LIMIT 30
    `).all(cid, bid);

    res.json({ stage_totals: stageRows, low_stock: lowStock, recent_movements: recentMovements });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/supplier-balances — suppliers with outstanding balance (we owe > 0)
router.get('/reports/supplier-balances', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    // Compute live balance: total_purchased - total_paid per supplier
    const rows = db.prepare(`
      SELECT s.id, s.code, s.name, s.phone,
             ROUND(COALESCE(p.total_purchased, 0) - COALESCE(pp.total_paid, 0), 2) AS balance
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(total_amount) AS total_purchased FROM purchases WHERE company_id = ? AND branch_id = ? GROUP BY supplier_id
      ) p ON p.supplier_id = s.id
      LEFT JOIN (
        SELECT pur.supplier_id, SUM(pp2.amount) AS total_paid
        FROM purchases_payments pp2
        JOIN purchases pur ON pp2.purchase_id = pur.id AND pur.company_id = pp2.company_id
        WHERE pp2.company_id = ? AND pp2.branch_id = ? GROUP BY pur.supplier_id
      ) pp ON pp.supplier_id = s.id
      WHERE s.company_id = ? AND s.branch_id = ?
        AND (COALESCE(p.total_purchased, 0) - COALESCE(pp.total_paid, 0)) > 0
      ORDER BY balance DESC
    `).all(cid, bid, cid, bid, cid, bid);
    const total = rows.reduce((s, r) => s + (r.balance || 0), 0);
    res.json({ suppliers: rows, total_payable: Math.round(total * 100) / 100 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/customer-balances', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const rows = db.prepare(`
      SELECT id, code, name, phone, address,
             ROUND(balance, 2) AS balance
      FROM clients
      WHERE company_id = ? AND branch_id = ? AND balance > 0
      ORDER BY balance DESC
    `).all(cid, bid);
    const total = rows.reduce((s, r) => s + (r.balance || 0), 0);
    res.json({ clients: rows, total_receivable: Math.round(total * 100) / 100 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/daily-sales', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { from, to } = req.query;
    let where = `s.company_id = ? AND s.branch_id = ? AND s.status NOT IN ('credit_note','adjustment')`;
    const params = [cid, bid];
    if (from) { where += ` AND s.date >= ?`; params.push(from); }
    if (to)   { where += ` AND s.date <= ?`; params.push(to); }

    const rows = db.prepare(`
      SELECT
        s.date,
        COUNT(s.id)                   AS invoice_count,
        ROUND(SUM(s.final_amount), 2) AS total_sales,
        ROUND(SUM(COALESCE(sp.paid, 0)), 2) AS total_paid,
        ROUND(SUM(s.final_amount) - SUM(COALESCE(sp.paid, 0)), 2) AS total_remaining
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount) AS paid, company_id
        FROM sales_payments
        WHERE company_id = ? AND branch_id = ?
        GROUP BY sale_id
      ) sp ON sp.sale_id = s.id AND sp.company_id = s.company_id
      WHERE ${where}
      GROUP BY s.date
      ORDER BY s.date DESC
    `).all(cid, bid, ...params);

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/branch-performance — sales + inventory breakdown per branch
router.get('/reports/branch-performance', (req, res) => {
  try {
    const cid = req.company_id;
    const branches = db.prepare(`SELECT id, name, code, branch_type FROM branches WHERE company_id = ?`).all(cid);

    const result = branches.map(br => {
      // Total sales invoiced from clients belonging to this branch
      const salesData = db.prepare(`
        SELECT COALESCE(SUM(s.final_amount), 0) AS total_sales, COUNT(s.id) AS invoice_count
        FROM sales s
        JOIN clients c ON c.id = s.client_id AND c.company_id = s.company_id
        WHERE s.company_id = ? AND c.branch_id = ?
          AND s.status NOT IN ('credit_note','adjustment')
      `).get(cid, br.id);

      // Inventory stock for warehouses in this branch
      const stockData = db.prepare(`
        SELECT COALESCE(SUM(i.quantity), 0) AS total_qty,
               COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_value
        FROM inventory i
        JOIN warehouses w ON w.id = i.warehouse_id AND w.company_id = i.company_id
        WHERE i.company_id = ? AND w.branch_id = ?
      `).get(cid, br.id);

      // Client count and outstanding receivables
      const clientData = db.prepare(`
        SELECT COUNT(*) AS client_count,
               COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS receivables
        FROM clients WHERE company_id = ? AND branch_id = ?
      `).get(cid, br.id);

      return {
        branch_id:     br.id,
        branch_name:   br.name,
        branch_code:   br.code,
        branch_type:   br.branch_type,
        total_sales:   Math.round((salesData.total_sales  || 0) * 100) / 100,
        invoice_count: salesData.invoice_count  || 0,
        total_qty:     Math.round((stockData.total_qty    || 0) * 1000) / 1000,
        stock_value:   Math.round((stockData.total_value  || 0) * 100) / 100,
        client_count:  clientData.client_count  || 0,
        receivables:   Math.round((clientData.receivables || 0) * 100) / 100
      };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/recent-payments — last 10 sales payments + treasury receipts
router.get('/reports/recent-payments', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const rows = db.prepare(`
      SELECT
        DATE(sp.created_at) AS payment_date,
        sp.payment_type     AS method,
        sp.amount,
        s.invoice_number    AS reference,
        c.name              AS party_name
      FROM sales_payments sp
      JOIN sales s    ON s.id = sp.sale_id AND s.company_id = sp.company_id
      JOIN clients c  ON c.id = s.client_id AND c.company_id = s.company_id
      WHERE sp.company_id = ? AND sp.branch_id = ?
      ORDER BY sp.created_at DESC
      LIMIT 10
    `).all(cid, bid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// COLOR ANALYTICS REPORT
// GET /api/reports/color-analytics
// - Most sold colors (by quantity from sales_items)
// - Colors with low stock (wholesale_kg < 5)
// - Colors not sold recently (last sale > 30 days or never)
// ============================================================
router.get('/reports/color-analytics', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;

    // Most sold colors (top 10, all time) — sales_items has color_code_id
    const mostSold = db.prepare(`
      SELECT
        COALESCE(cc.main_color, 'بدون')  AS color_name,
        COALESCE(cc.code, '')             AS color_code,
        ROUND(SUM(si.quantity), 2)        AS total_qty_sold,
        COUNT(DISTINCT si.sale_id)        AS invoice_count
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id AND s.company_id = si.company_id
      LEFT JOIN color_codes cc ON cc.id = si.color_code_id AND cc.company_id = si.company_id
      WHERE si.company_id = ? AND s.branch_id = ? AND si.color_code_id IS NOT NULL
      GROUP BY si.color_code_id, COALESCE(cc.main_color,'بدون'), COALESCE(cc.code,'')
      ORDER BY total_qty_sold DESC
      LIMIT 10
    `).all(cid, bid);

    // Least sold colors (bottom 10, sold at least once)
    const leastSold = db.prepare(`
      SELECT
        COALESCE(cc.main_color, 'بدون')  AS color_name,
        COALESCE(cc.code, '')             AS color_code,
        ROUND(SUM(si.quantity), 2)        AS total_qty_sold,
        COUNT(DISTINCT si.sale_id)        AS invoice_count
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id AND s.company_id = si.company_id
      LEFT JOIN color_codes cc ON cc.id = si.color_code_id AND cc.company_id = si.company_id
      WHERE si.company_id = ? AND s.branch_id = ? AND si.color_code_id IS NOT NULL
      GROUP BY si.color_code_id, COALESCE(cc.main_color,'بدون'), COALESCE(cc.code,'')
      ORDER BY total_qty_sold ASC
      LIMIT 10
    `).all(cid, bid);

    // Low stock colors in wholesale_kg/retail_kg (0 < quantity < 5)
    const LOW = 5;
    const lowStock = db.prepare(`
      SELECT
        COALESCE(mc.color_code, cc.main_color, 'بدون') AS color_name,
        COALESCE(mc.hex_code, '')                        AS hex_code,
        ROUND(i.quantity, 3)                             AS quantity,
        i.inventory_stage
      FROM inventory i
      LEFT JOIN color_codes   cc ON cc.id = i.color_code_id   AND cc.company_id = i.company_id
      LEFT JOIN master_colors mc ON mc.id = i.master_color_id  AND mc.company_id = i.company_id
      WHERE i.company_id = ? AND i.branch_id = ?
        AND i.inventory_stage IN ('wholesale_kg','retail_kg')
        AND i.quantity > 0 AND i.quantity < ?
      ORDER BY i.quantity ASC
      LIMIT 20
    `).all(cid, bid, LOW);

    // Colors not sold in last 30 days (have wholesale stock but no recent sale)
    const notRecentlySold = db.prepare(`
      SELECT
        COALESCE(mc.color_code, cc.main_color, 'بدون') AS color_name,
        COALESCE(mc.hex_code, '')                        AS hex_code,
        ROUND(i.quantity, 3)                             AS quantity,
        MAX(s.date)                                      AS last_sale_date,
        CAST(julianday('now') - julianday(MAX(s.date)) AS INTEGER) AS days_since_sale
      FROM inventory i
      LEFT JOIN color_codes   cc ON cc.id = i.color_code_id   AND cc.company_id = i.company_id
      LEFT JOIN master_colors mc ON mc.id = i.master_color_id  AND mc.company_id = i.company_id
      LEFT JOIN sales_items   si ON si.color_code_id = i.color_code_id AND si.company_id = i.company_id
      LEFT JOIN sales          s ON s.id = si.sale_id AND s.company_id = si.company_id
      WHERE i.company_id = ? AND i.branch_id = ?
        AND i.inventory_stage = 'wholesale_kg'
        AND i.quantity > 0
      GROUP BY i.id, COALESCE(mc.color_code, cc.main_color, 'بدون'), COALESCE(mc.hex_code, '')
      HAVING last_sale_date IS NULL OR days_since_sale > 30
      ORDER BY CASE WHEN last_sale_date IS NULL THEN 0 ELSE 1 END ASC, days_since_sale DESC
      LIMIT 15
    `).all(cid, bid);

    res.json({ most_sold: mostSold, least_sold: leastSold, low_stock: lowStock, not_recently_sold: notRecentlySold });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// AUDIT LOG
// ============================================

router.get('/audit/log', (req, res) => {
  try {
    const { table_name, record_id, user, limit } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE 1=1', params = [];
    if (table_name) { sql += ' AND table_name = ?'; params.push(table_name); }
    if (record_id) { sql += ' AND record_id = ?'; params.push(record_id); }
    if (user) { sql += ' AND user = ?'; params.push(user); }
    sql += ' ORDER BY created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
