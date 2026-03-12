const { db, originalPrepare } = require('./connection');
const bcrypt = require('bcryptjs');
function runMigrations() {
// schema already executed in connection.js

// ============================================
// INDEXES: sale_items
// ============================================
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id   ON sale_items(sale_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_branch_id ON sale_items(branch_id)`);

// Idempotent migration: add company_id to sale_items if table already existed without it
try {
  const siCols = db.prepare('PRAGMA table_info(sale_items)').all().map(c => c.name);
  if (!siCols.includes('company_id')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1');
    console.log('[MIGRATION] Added company_id to sale_items');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_company ON sale_items(company_id)`);
} catch (siMigErr) {
  console.error('[MIGRATION WARNING] sale_items company_id:', siMigErr.message);
}

// ============================================
// INDEXES: master_colors (v6)
// UNIQUE(color_code, company_id) enforces one canonical entry per company.
// Plain INDEX(company_id) for all isolation queries.
// ============================================
try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_master_colors_code_company
      ON master_colors(color_code, company_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_master_colors_company
      ON master_colors(company_id)
  `);
  console.log('[MASTER COLOR] Indexes ready (UNIQUE code+company, company)');
} catch (mcIdxErr) {
  console.error('[MASTER COLOR WARNING] Index creation:', mcIdxErr.message);
}

// ============================================
// MIGRATION: inventory — add master_color_id (v6-INVENTORY-LINKED)
// Idempotent: PRAGMA check before ALTER.
// Backfill: match inventory.color_code_id → color_codes.code → master_colors.color_code
// ============================================
try {
  const invCols = db.prepare('PRAGMA table_info(inventory)').all().map(c => c.name);
  if (!invCols.includes('master_color_id')) {
    db.exec('ALTER TABLE inventory ADD COLUMN master_color_id INTEGER');
    console.log('[MC-LINK] Added master_color_id to inventory');
  }

  // FK lookup index
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_master_color ON inventory(master_color_id)`);

  // Backfill: join through color_codes → master_colors by matching code text
  // Only updates rows that have a color_code_id but no master_color_id yet
  const backfill = db.prepare(`
    UPDATE inventory
    SET master_color_id = (
      SELECT mc.id
      FROM   master_colors mc
      JOIN   color_codes   cc ON UPPER(TRIM(cc.code)) = UPPER(TRIM(mc.color_code))
      WHERE  cc.id             = inventory.color_code_id
        AND  mc.company_id     = inventory.company_id
      LIMIT 1
    )
    WHERE color_code_id  IS NOT NULL
      AND master_color_id IS NULL
  `).run();

  if (backfill.changes > 0)
    console.log(`[MC-LINK] Backfilled master_color_id for ${backfill.changes} inventory rows`);
  else
    console.log('[MC-LINK] Backfill: 0 rows matched — populate master_colors catalog to auto-link');

  console.log('[MC-LINK] inventory ↔ master_colors ready');
} catch (mcLinkErr) {
  console.error('[MC-LINK ERROR]', mcLinkErr.message);
}

// ============================================
// UNIQUE INDEX: invoice_revision_items
// SQLite forbids expressions (COALESCE/IFNULL) inside a table-level UNIQUE constraint,
// so we create a partial unique index here instead. IFNULL maps NULL → 0 so that two
// NULL values are treated as equal (preventing duplicate service+artisan pairs).
// ============================================
try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_revision_item
    ON invoice_revision_items (
      revision_id,
      IFNULL(service_type_id, 0),
      IFNULL(artisan_id, 0)
    )
  `);
} catch (revItemIdxErr) {
  console.error('[MIGRATION WARNING] idx_unique_revision_item index:', revItemIdxErr.message);
}

// ============================================
// MIGRATION: Deduplicate inventory & add UNIQUE constraint
// ============================================
try {
  // Check if unique index already exists
  const idxExists = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inventory_unique'").get();
  if (!idxExists) {
    // Merge duplicate rows: keep the one with lowest id, sum quantities, keep max costs/prices
    const duplicates = db.prepare(`
      SELECT warehouse_id, product_type_id, COALESCE(color_code_id, -1) as cc_id,
             MIN(id) as keep_id, COUNT(*) as cnt,
             SUM(quantity) as total_qty, MAX(unit_cost) as max_cost, MAX(unit_price) as max_price,
             SUM(opening_balance) as total_opening
      FROM inventory
      GROUP BY warehouse_id, product_type_id, COALESCE(color_code_id, -1)
      HAVING COUNT(*) > 1
    `).all();

    if (duplicates.length > 0) {
      // Disable FK checks during migration to allow re-pointing references
      db.pragma('foreign_keys = OFF');
      const mergeTransaction = db.transaction(() => {
        // Tables that reference inventory(id) — re-point all FKs to the kept row
        const fkTables = [
          { table: 'inventory_movements', col: 'inventory_id' },
          { table: 'manufacturing_inputs', col: 'inventory_id' },
          { table: 'manufacturing_outputs', col: 'output_inventory_id' },
          { table: 'tdwar_order_colors', col: 'bobine_inventory_id' },
          { table: 'tdwar_order_bags', col: 'jaab_inventory_id' },
          { table: 'production_entries', col: 'output_inventory_id' },
          { table: 'sales_items', col: 'inventory_id' },
          { table: 'purchases_items', col: 'inventory_id' }
        ];
        for (const dup of duplicates) {
          const colorCondition = dup.cc_id === -1 ? 'color_code_id IS NULL' : `color_code_id = ${dup.cc_id}`;
          // Get IDs of rows to delete
          const dupeIds = db.prepare(`
            SELECT id FROM inventory
            WHERE warehouse_id = ? AND product_type_id = ? AND ${colorCondition} AND id != ?
          `).all(dup.warehouse_id, dup.product_type_id, dup.keep_id).map(r => r.id);

          if (dupeIds.length > 0) {
            const placeholders = dupeIds.map(() => '?').join(',');
            // Re-point all FK references from duplicate IDs to the kept ID
            for (const fk of fkTables) {
              try {
                db.prepare(`UPDATE ${fk.table} SET ${fk.col} = ? WHERE ${fk.col} IN (${placeholders})`).run(dup.keep_id, ...dupeIds);
              } catch (e) { /* table may not exist yet */ }
            }
          }
          // Update kept row with merged totals
          db.prepare(`UPDATE inventory SET quantity = ?, unit_cost = ?, unit_price = ?, opening_balance = ? WHERE id = ?`)
            .run(dup.total_qty, dup.max_cost, dup.max_price, dup.total_opening, dup.keep_id);
          // Delete duplicate rows
          db.prepare(`
            DELETE FROM inventory
            WHERE warehouse_id = ? AND product_type_id = ? AND ${colorCondition} AND id != ?
          `).run(dup.warehouse_id, dup.product_type_id, dup.keep_id);
        }
      });
      mergeTransaction();
      db.pragma('foreign_keys = ON');
      console.log(`[MIGRATION] Merged ${duplicates.length} duplicate inventory groups`);
    }
    // Create unique index (NULLs in color_code_id are treated as distinct by SQLite, so use COALESCE)
    db.exec(`CREATE UNIQUE INDEX idx_inventory_unique ON inventory(warehouse_id, product_type_id, COALESCE(color_code_id, 0))`);
    console.log('[MIGRATION] Created unique index on inventory(warehouse_id, product_type_id, color_code_id)');
  }
} catch (migrationErr) {
  console.error('[MIGRATION WARNING] Inventory dedup migration:', migrationErr.message);
}

// ============================================
// MIGRATION: Rebuild idx_inventory_unique to include color_description
// Old index: (warehouse_id, product_type_id, COALESCE(color_code_id,0))
// New index: (warehouse_id, product_type_id, COALESCE(color_code_id,0), LOWER(TRIM(COALESCE(color_description,''))))
// Required because purchase rows all have color_code_id=NULL — old index allowed only
// one such row per (warehouse,product); new index differentiates by color_description.
// ============================================
try {
  const idxCols = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inventory_unique'"
  ).get();
  if (idxCols) {
    // Inspect how many columns the current index has
    const info = db.prepare('PRAGMA index_info(idx_inventory_unique)').all();
    // If it only has 3 entries it is the old schema — rebuild it
    if (info.length === 3) {
      db.exec(`DROP INDEX idx_inventory_unique`);
      db.exec(`CREATE UNIQUE INDEX idx_inventory_unique ON inventory(
        warehouse_id,
        product_type_id,
        COALESCE(color_code_id, 0),
        LOWER(TRIM(COALESCE(color_description, '')))
      )`);
      console.log('[MIGRATION] Rebuilt idx_inventory_unique to include color_description');
    }
  } else {
    // Index was somehow dropped — recreate with full 4-column definition
    db.exec(`CREATE UNIQUE INDEX idx_inventory_unique ON inventory(
      warehouse_id,
      product_type_id,
      COALESCE(color_code_id, 0),
      LOWER(TRIM(COALESCE(color_description, '')))
    )`);
    console.log('[MIGRATION] Created idx_inventory_unique (4-column)');
  }
} catch (idxMigErr) {
  console.error('[MIGRATION WARNING] idx_inventory_unique rebuild:', idxMigErr.message);
}

// ============================================
// MIGRATION: Add artisan_type column to artisans
// ============================================
try {
  const artisanCols = db.prepare("PRAGMA table_info(artisans)").all().map(c => c.name);
  if (!artisanCols.includes('artisan_type')) {
    db.exec(`ALTER TABLE artisans ADD COLUMN artisan_type TEXT DEFAULT 'SERVICE'`);
    // Mark known SABRA/packing artisans — we detect them by craft_type containing SABRA/packing keywords
    db.prepare(`
      UPDATE artisans SET artisan_type = 'SABRA_PACKING'
      WHERE UPPER(craft_type) LIKE '%SABRA%'
         OR UPPER(craft_type) LIKE '%PACK%'
         OR UPPER(name) LIKE '%SABRA%'
    `).run();
    console.log('[MIGRATION] Added artisan_type column to artisans');
  }
} catch (artisanTypeMigErr) {
  console.error('[MIGRATION WARNING] artisan_type migration:', artisanTypeMigErr.message);
}

// ============================================
// MIGRATION: Add invoice_status column to sales
// ============================================
try {
  const salesCols = db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
  if (!salesCols.includes('invoice_status')) {
    db.exec(`ALTER TABLE sales ADD COLUMN invoice_status TEXT DEFAULT 'Completed'`);
    // Existing sales are already completed
    db.prepare(`UPDATE sales SET invoice_status = 'Completed' WHERE invoice_status IS NULL`).run();
    console.log('[MIGRATION] Added invoice_status column to sales');
  }
} catch (invoiceStatusErr) {
  console.error('[MIGRATION WARNING] invoice_status migration:', invoiceStatusErr.message);
}

// ============================================
// MIGRATION: Add deposit_amount column to sales
// ============================================
try {
  const salesCols2 = db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
  if (!salesCols2.includes('deposit_amount')) {
    db.exec(`ALTER TABLE sales ADD COLUMN deposit_amount REAL DEFAULT 0`);
    console.log('[MIGRATION] Added deposit_amount column to sales');
  }
} catch (depositMigErr) {
  console.error('[MIGRATION WARNING] deposit_amount migration:', depositMigErr.message);
}

// ============================================
// MIGRATION: Add artisan_rate column to invoice_revision_items
// Stores the frozen artisan cost-rate at the moment a revision item is created.
// DEFAULT 0 so all existing rows read as zero-cost (safe: they predate this feature).
// ============================================
try {
  const iriCols = db.prepare("PRAGMA table_info(invoice_revision_items)").all().map(c => c.name);
  if (!iriCols.includes('artisan_rate')) {
    db.exec(`ALTER TABLE invoice_revision_items ADD COLUMN artisan_rate REAL DEFAULT 0`);
    console.log('[MIGRATION] Added artisan_rate column to invoice_revision_items');
  }
} catch (artisanRateMigErr) {
  console.error('[MIGRATION WARNING] artisan_rate column migration:', artisanRateMigErr.message);
}

// ============================================
// MIGRATION: Seed artisan_service_rates from existing artisan_services rows
// artisan_services already has (artisan_id, service_type_id, rate).
// We copy each distinct pair as an initial rate row with effective_from = '2000-01-01'
// so it acts as an eternal baseline that real dated rows will supersede.
// INSERT OR IGNORE prevents duplicate violations on re-runs.
// ============================================
try {
  db.prepare(`
    INSERT OR IGNORE INTO artisan_service_rates (artisan_id, service_type_id, rate, effective_from)
    SELECT artisan_id, service_type_id, rate, '2000-01-01'
    FROM artisan_services
    WHERE rate IS NOT NULL
  `).run();
  console.log('[MIGRATION] Seeded artisan_service_rates from artisan_services');
} catch (seedRatesMigErr) {
  console.error('[MIGRATION WARNING] artisan_service_rates seed migration:', seedRatesMigErr.message);
}

// ============================================
// MIGRATION: Backfill revision 1 for every sale that has no revisions yet
// Idempotent: skips any sale that already has at least one revision row.
// Copies sales_items into invoice_revision_items with:
//   service_type_id = NULL  (sales_items are product lines, not service lines)
//   artisan_id      = NULL
//   quantity / unit_price copied directly
//   status          = 'Completed'  (original sale is already done)
// ============================================
try {
  const backfillTx = db.transaction(() => {
    // Find all sales that have no entry in invoice_revisions
    const unbackfilled = db.prepare(`
      SELECT s.id, s.date, s.created_by
      FROM sales s
      WHERE NOT EXISTS (
        SELECT 1 FROM invoice_revisions r WHERE r.invoice_id = s.id
      )
      -- Only backfill real sales (exclude credit_notes and adjustments which should not have revisions)
      AND s.status NOT IN ('credit_note', 'adjustment')
    `).all();

    const insertRev = db.prepare(`
      INSERT INTO invoice_revisions (invoice_id, revision_number, reason, created_by, created_at)
      VALUES (?, 1, 'النسخة الأصلية من الفاتورة (ترحيل تلقائي)', ?, ?)
    `);
    const insertRevItem = db.prepare(`
      INSERT OR IGNORE INTO invoice_revision_items
        (revision_id, service_type_id, quantity, unit_price, artisan_id, status, notes)
      VALUES (?, ?, ?, ?, NULL, 'Completed', ?)
    `);

    let salesBackfilled = 0;
    let itemsBackfilled = 0;

    for (const sale of unbackfilled) {
      // Create revision 1
      const revResult = insertRev.run(
        sale.id,
        sale.created_by || 'system',
        sale.date || new Date().toISOString()
      );
      const revId = revResult.lastInsertRowid;

      // Copy sales_items for this sale
      // service_type_id: use the special_order.service_type_id if it is a special-order item,
      // otherwise NULL — product sales have no service type.
      const saleItems = db.prepare(`
        SELECT si.quantity, si.unit_price, si.product_name,
               si.is_special_order, so.service_type_id
        FROM sales_items si
        LEFT JOIN special_orders so ON si.special_order_id = so.id
        WHERE si.sale_id = ?
      `).all(sale.id);

      for (const si of saleItems) {
        insertRevItem.run(
          revId,
          si.service_type_id || null,   // only populated for special-order service items
          si.quantity,
          si.unit_price,
          si.product_name               // stored as notes so product identity is not lost
        );
        itemsBackfilled++;
      }

      salesBackfilled++;
    }

    return { salesBackfilled, itemsBackfilled };
  });

  const backfillResult = backfillTx();
  if (backfillResult.salesBackfilled > 0) {
    console.log(`[MIGRATION] Backfilled revision 1 for ${backfillResult.salesBackfilled} sales (${backfillResult.itemsBackfilled} items)`);
  }
} catch (backfillErr) {
  console.error('[MIGRATION WARNING] Revision 1 backfill:', backfillErr.message);
}

// ============================================
// CLEANUP: Remove garbled test records (CP1256 bytes) inserted during
// debugging session on 2026-02-21 23:52. Idempotent — skips if already gone.
// Detects by created_at timestamp which is unique to that session.
// ============================================
try {
  const garbledWH = db.prepare(
    `SELECT id FROM warehouses WHERE created_at >= '2026-02-21 23:52:00'`
  ).all().map(r => r.id);
  const garbledPT = db.prepare(
    `SELECT id FROM product_types WHERE created_at >= '2026-02-21 23:52:00'`
  ).all().map(r => r.id);

  if (garbledWH.length > 0 || garbledPT.length > 0) {
    db.pragma('foreign_keys = OFF');
    const cleanupTx = db.transaction(() => {
      const whList = garbledWH.length ? garbledWH.join(',') : '0';
      const ptList = garbledPT.length ? garbledPT.join(',') : '0';

      db.prepare(`DELETE FROM inventory_movements WHERE inventory_id IN (
        SELECT id FROM inventory WHERE warehouse_id IN (${whList}) OR product_type_id IN (${ptList})
      )`).run();
      db.prepare(`DELETE FROM purchases_items WHERE inventory_id IN (
        SELECT id FROM inventory WHERE warehouse_id IN (${whList}) OR product_type_id IN (${ptList})
      )`).run();
      db.prepare(`DELETE FROM inventory
        WHERE warehouse_id IN (${whList}) OR product_type_id IN (${ptList})`).run();
      db.prepare(`DELETE FROM product_types WHERE id IN (${ptList})`).run();
      db.prepare(`DELETE FROM warehouses WHERE id IN (${whList})`).run();
    });
    cleanupTx();
    db.pragma('foreign_keys = ON');
    console.log('[CLEANUP] Removed garbled test records (2026-02-21 23:52 session)');
  }
} catch (cleanupErr) {
  console.error('[CLEANUP WARNING] garbled record removal:', cleanupErr.message);
}

// ============================================
// MIGRATION: Add status + applied_credit columns to purchases
// ============================================
try {
  const purchCols = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
  if (!purchCols.includes('status')) {
    db.exec(`ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'OPEN'`);
    // Mark existing purchases as CLOSED if fully paid, else OPEN
    db.prepare(`
      UPDATE purchases SET status = CASE
        WHEN total_amount <= COALESCE(
          (SELECT SUM(amount) FROM purchases_payments WHERE purchase_id = purchases.id), 0
        ) THEN 'CLOSED'
        ELSE 'OPEN'
      END
    `).run();
    console.log('[MIGRATION] Added status column to purchases');
  }
  if (!purchCols.includes('applied_credit')) {
    db.exec(`ALTER TABLE purchases ADD COLUMN applied_credit REAL DEFAULT 0`);
    console.log('[MIGRATION] Added applied_credit column to purchases');
  }
} catch (purchMigErr) {
  console.error('[MIGRATION WARNING] purchases columns migration:', purchMigErr.message);
}

// ============================================
// MIGRATION: Add warehouse_id to purchases (invoice-level warehouse)
// ============================================
try {
  const purchCols2 = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
  if (!purchCols2.includes('warehouse_id')) {
    db.exec(`ALTER TABLE purchases ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)`);
    console.log('[MIGRATION] Added warehouse_id column to purchases');
  }
} catch (purchWHMigErr) {
  console.error('[MIGRATION WARNING] purchases warehouse_id migration:', purchWHMigErr.message);
}

// ============================================
// MIGRATION: Add invoice_status to purchases (Draft/Confirmed workflow)
// ============================================
try {
  const purchCols3 = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
  if (!purchCols3.includes('invoice_status')) {
    db.exec(`ALTER TABLE purchases ADD COLUMN invoice_status TEXT DEFAULT 'Draft'`);
    console.log('[MIGRATION] Added invoice_status column to purchases');
  }
} catch (purchISMigErr) {
  console.error('[MIGRATION WARNING] purchases invoice_status migration:', purchISMigErr.message);
}

// ============================================
// MULTI-COMPANY FOUNDATION v4 — Seed default company + admin
// Idempotent: only inserts if table is empty.
// ============================================
try {
  const companyCount = db.prepare('SELECT COUNT(*) AS n FROM companies').get().n;
  if (companyCount === 0) {
    db.prepare(`INSERT INTO companies (name) VALUES (?)`).run('GROFIL FOURNITURE');
    console.log('[MULTI-COMPANY] Default company seeded: GROFIL FOURNITURE');
  } else {
    console.log(`[MULTI-COMPANY] Companies present (${companyCount})`);
  }
} catch (companyErr) {
  console.error('[MULTI-COMPANY WARNING] Company seed:', companyErr.message);
}

try {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      `INSERT INTO users (username, password_hash, role, company_id) VALUES (?, ?, 'ADMIN', 1)`
    ).run('admin', passwordHash);
    console.log('[MULTI-COMPANY] Default admin user seeded (username: admin)');
  } else {
    console.log(`[MULTI-COMPANY] Users present (${userCount})`);
  }
} catch (userErr) {
  console.error('[MULTI-COMPANY WARNING] User seed:', userErr.message);
}

// ============================================
// MULTI-COMPANY STRUCTURE v4 — Add company_id to all core tables
// Idempotent: checks PRAGMA table_info before each ALTER.
// DEFAULT 1 ensures all existing rows belong to company 1.
// ============================================
try {
  // Tables that must already exist — ALTER if missing company_id
  const alterTargets = [
    'sales', 'purchases', 'inventory',
    'journal_entries', 'journal_lines', 'accounts',
    'clients', 'suppliers', 'partners'
  ];

  alterTargets.forEach(table => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes('company_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1`);
        console.log(`[MULTI-COMPANY STRUCTURE] Added company_id to ${table}`);
      }
    } catch (alterErr) {
      console.error(`[MULTI-COMPANY STRUCTURE WARNING] ALTER ${table}:`, alterErr.message);
    }
  });

  // capital_transactions does not exist yet — create it with company_id from the start
  db.exec(`
    CREATE TABLE IF NOT EXISTS capital_transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id  INTEGER NOT NULL DEFAULT 1,
      date        TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      description TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    )
  `);

  // STEP 2 — Indexes for performance
  const indexTargets = [
    'sales', 'purchases', 'inventory',
    'journal_entries', 'journal_lines', 'accounts',
    'clients', 'suppliers', 'partners', 'capital_transactions'
  ];

  indexTargets.forEach(table => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_company ON ${table}(company_id)`);
    } catch (idxErr) {
      console.error(`[MULTI-COMPANY STRUCTURE WARNING] INDEX ${table}:`, idxErr.message);
    }
  });

  console.log('[MULTI-COMPANY STRUCTURE] company_id columns and indexes ready (10 tables)');
} catch (mcStructErr) {
  console.error('[MULTI-COMPANY STRUCTURE ERROR]', mcStructErr.message);
}

// ============================================
// MULTI-COMPANY FULL ISOLATION v4 — Phase 2
// Add company_id to all operational tables.
// Idempotent: PRAGMA table_info check before each ALTER.
// DEFAULT 1 assigns all existing rows to company 1.
// ============================================
try {
  const phase2Tables = [
    'sales_items', 'sales_payments',
    'invoice_revisions', 'invoice_revision_items',
    'purchases_items', 'purchases_payments',
    'inventory_movements',
    'warehouses', 'color_codes',
    'checks_portfolio', 'checks_issued',
    'treasury_ledger', 'expenses',
    'manufacturing_orders',
    'service_types',
    'artisan_service_rates', 'artisans', 'artisan_accounts',
    'employees', 'vehicle_tours'
  ];

  let altered = 0;
  phase2Tables.forEach(table => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes('company_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1`);
        console.log(`[MC-ISOLATION] Added company_id to ${table}`);
        altered++;
      }
    } catch (alterErr) {
      console.error(`[MC-ISOLATION WARNING] ALTER ${table}:`, alterErr.message);
    }
  });

  // STEP 2 — Indexes for performance
  phase2Tables.forEach(table => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_company ON ${table}(company_id)`);
    } catch (idxErr) {
      console.error(`[MC-ISOLATION WARNING] INDEX ${table}:`, idxErr.message);
    }
  });

  const skipped = phase2Tables.length - altered;
  console.log(`[MC-ISOLATION] Phase 2 complete — altered: ${altered}, already had company_id: ${skipped} (${phase2Tables.length} tables total)`);
} catch (mcIsoErr) {
  console.error('[MC-ISOLATION ERROR]', mcIsoErr.message);
}

// ============================================
// MIGRATION: opening_balances — add company_id (missed in Phase 1/2)
// Idempotent: PRAGMA check before ALTER.
// ============================================
try {
  const obCols = db.prepare('PRAGMA table_info(opening_balances)').all().map(c => c.name);
  if (!obCols.includes('company_id')) {
    db.exec(`ALTER TABLE opening_balances ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1`);
    console.log('[MIGRATION] Added company_id to opening_balances');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_opening_balances_company ON opening_balances(company_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_balances_unique ON opening_balances(company_id, fiscal_year)`);
} catch (obMigErr) {
  console.error('[MIGRATION WARNING] opening_balances company_id:', obMigErr.message);
}

// ============================================
// MIGRATION: product_types — add company_id (missed in Phase 1/2)
// Idempotent: PRAGMA check before ALTER.
// ============================================
try {
  const ptCols = db.prepare('PRAGMA table_info(product_types)').all().map(c => c.name);
  if (!ptCols.includes('company_id')) {
    db.exec(`ALTER TABLE product_types ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1`);
    console.log('[MIGRATION] Added company_id to product_types');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_product_types_company ON product_types(company_id)`);
} catch (ptMigErr) {
  console.error('[MIGRATION WARNING] product_types company_id:', ptMigErr.message);
}

// ============================================
// BRANCH FOUNDATION v4 — STEP 1: branches table + branch_id columns
// Idempotent: CREATE IF NOT EXISTS + PRAGMA checks before each ALTER.
// ============================================
try {
  // STEP 1 — Create branches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      code       TEXT    UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default branch if empty
  const branchCount = originalPrepare('SELECT COUNT(*) AS n FROM branches').get().n;
  if (branchCount === 0) {
    db.prepare(`INSERT INTO branches (name, code) VALUES (?, ?)`).run('الفرع الرئيسي', 'BR-001');
    console.log('[BRANCH] Default branch seeded: الفرع الرئيسي (BR-001)');
  } else {
    console.log(`[BRANCH] Branches present (${branchCount})`);
  }

  // STEP 2 — Add branch_id to target tables
  ['sales', 'purchases', 'journal_entries'].forEach(table => {
    try {
      const cols = originalPrepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (!cols.includes('branch_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN branch_id INTEGER NOT NULL DEFAULT 1`);
        console.log(`[BRANCH] Added branch_id to ${table}`);
      }
    } catch (alterErr) {
      console.error(`[BRANCH WARNING] ALTER ${table}:`, alterErr.message);
    }
  });

  // STEP 3 — Index on journal_entries(branch_id)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_journal_branch ON journal_entries(branch_id)`);

  console.log('[BRANCH] Branch foundation ready');
} catch (branchErr) {
  console.error('[BRANCH ERROR]', branchErr.message);
}

// ============================================
// ACCOUNTING FOUNDATION v3 — STEP 1: Tables
// ============================================
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_number   TEXT UNIQUE NOT NULL,
  entry_date     DATE NOT NULL,
  reference_type TEXT,
  reference_id   INTEGER,
  description    TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_entry_id INTEGER NOT NULL,
  account_code     TEXT NOT NULL,
  debit            REAL DEFAULT 0,
  credit           REAL DEFAULT 0,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);
`);

// ============================================
// ACCOUNTING ENGINE: Migrate company_id + branch_id onto accounting tables
// ============================================
try {
  const accCols = originalPrepare('PRAGMA table_info(accounts)').all().map(c => c.name);
  if (!accCols.includes('company_id')) {
    db.exec('ALTER TABLE accounts ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1');
    console.log('[ACCOUNTING] Added company_id to accounts');
  }

  const jeCols = originalPrepare('PRAGMA table_info(journal_entries)').all().map(c => c.name);
  if (!jeCols.includes('company_id')) {
    db.exec('ALTER TABLE journal_entries ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1');
    console.log('[ACCOUNTING] Added company_id to journal_entries');
  }
  if (!jeCols.includes('branch_id')) {
    db.exec('ALTER TABLE journal_entries ADD COLUMN branch_id INTEGER');
    console.log('[ACCOUNTING] Added branch_id to journal_entries');
  }

  const jlCols = originalPrepare('PRAGMA table_info(journal_lines)').all().map(c => c.name);
  if (!jlCols.includes('company_id')) {
    db.exec('ALTER TABLE journal_lines ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1');
    console.log('[ACCOUNTING] Added company_id to journal_lines');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference_type, reference_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_journal_lines_company ON journal_lines(company_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id)');
} catch (accMigErr) {
  console.error('[ACCOUNTING WARNING] Migration:', accMigErr.message);
}

// ============================================
// ACCOUNTING FOUNDATION v3 — STEP 2: Seed COA
// ============================================
try {
  const accountCount = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get().cnt;
  if (accountCount === 0) {
    const insertAccount = db.prepare(`INSERT INTO accounts (code, name, type) VALUES (?, ?, ?)`);
    const seedCOA = db.transaction(() => {
      insertAccount.run('1101', 'الصندوق',       'ASSET');
      insertAccount.run('1102', 'البنك',          'ASSET');
      insertAccount.run('1103', 'محفظة الشيكات',  'ASSET');
      insertAccount.run('1104', 'العملاء',        'ASSET');
      insertAccount.run('1105', 'المخزون',        'ASSET');
      insertAccount.run('2101', 'الموردون',       'LIABILITY');
      insertAccount.run('3101', 'رأس المال',      'EQUITY');
      insertAccount.run('4100', 'المبيعات',       'REVENUE');
      insertAccount.run('5101', 'تكلفة المبيعات', 'EXPENSE');
      insertAccount.run('5204', 'رسوم بنكية',     'EXPENSE');
    });
    seedCOA();
    console.log('[ACCOUNTING] Chart of accounts seeded (10 accounts)');
  } else {
    console.log(`[ACCOUNTING] Chart of accounts present (${accountCount} accounts)`);
  }
} catch (coaErr) {
  console.error('[ACCOUNTING WARNING] COA seed:', coaErr.message);
}

// ============================================
// ACCOUNTING ENGINE: Ensure additional COA accounts exist
// ============================================
try {
  const additionalAccounts = [
    { code: '5200', name: 'مصاريف تشغيلية',   type: 'EXPENSE' },
    { code: '5300', name: 'تسويات المخزون',    type: 'EXPENSE' }
  ];
  for (const acc of additionalAccounts) {
    const exists = originalPrepare('SELECT 1 FROM accounts WHERE code = ?').get(acc.code);
    if (!exists) {
      originalPrepare('INSERT INTO accounts (code, name, type) VALUES (?, ?, ?)').run(acc.code, acc.name, acc.type);
      console.log(`[ACCOUNTING] Seeded COA: ${acc.code} ${acc.name}`);
    }
  }
} catch (coaExtra) {
  console.error('[ACCOUNTING WARNING] Additional COA:', coaExtra.message);
}

// Note: createJournalEntry, postJournal, createJournalEntryV7 moved to server/utils/accounting.js

// ============================================
// ERP-v7: BRANCH TRANSFERS MIGRATION
// 1. Add company_id to branches (if missing) so isolation guard can scope it
// 2. Create indexes for branch_transfers + branch_transfer_items
// 3. Ensure internal-transfer COA accounts exist (1104,1105,2101,4100)
// ============================================
try {
  // 1. company_id on branches
  const brCols = originalPrepare('PRAGMA table_info(branches)').all().map(c => c.name);
  if (!brCols.includes('company_id')) {
    db.exec('ALTER TABLE branches ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1');
    console.log('[v7-TRANSFER] Added company_id to branches');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id)`);

  // 2. Indexes for branch_transfers
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branch_transfers_company  ON branch_transfers(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branch_transfers_from     ON branch_transfers(from_branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branch_transfers_to       ON branch_transfers(to_branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branch_transfer_items_tid ON branch_transfer_items(transfer_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branch_transfer_items_cid ON branch_transfer_items(company_id)`);

  console.log('[v7-TRANSFER] Branch transfer indexes ready');
} catch (v7IdxErr) {
  console.error('[v7-TRANSFER WARNING] Indexes:', v7IdxErr.message);
}

// 3. Ensure internal-transfer COA accounts exist (idempotent — INSERT OR IGNORE)
try {
  const v7Accounts = [
    { code: '1104', name: 'مديونية داخلية بين الفروع', type: 'ASSET'     },
    { code: '1105', name: 'مخزون داخلي مستلم',          type: 'ASSET'     },
    { code: '2101', name: 'دائنية داخلية بين الفروع',   type: 'LIABILITY' },
    { code: '4100', name: 'مبيعات داخلية بين الفروع',   type: 'REVENUE'   }
  ];
  for (const acc of v7Accounts) {
    const exists = originalPrepare('SELECT 1 FROM accounts WHERE code = ?').get(acc.code);
    if (!exists) {
      // Guard is still inactive here, so direct db.prepare is fine
      db.prepare('INSERT INTO accounts (code, name, type, company_id) VALUES (?, ?, ?, 1)')
        .run(acc.code, acc.name, acc.type);
      console.log(`[v7-TRANSFER] Seeded COA: ${acc.code} ${acc.name}`);
    }
  }
  console.log('[v7-TRANSFER] COA internal-transfer accounts verified');
} catch (v7CoaErr) {
  console.error('[v7-TRANSFER WARNING] COA seed:', v7CoaErr.message);
}

// 4. Seed canonical branches: الجملة + التقسيط (idempotent by name+company)
// These are the two branches required by the internal-transfer business model.
try {
  const ensureBranch = (name, code) => {
    const exists = originalPrepare('SELECT id FROM branches WHERE name = ? AND company_id = 1').get(name);
    if (!exists) {
      db.prepare('INSERT INTO branches (name, code, company_id) VALUES (?, ?, 1)').run(name, code);
      console.log(`[v7-TRANSFER] Seeded branch: ${name} (${code})`);
    }
  };
  ensureBranch('الجملة',   'BR-JOMLA');
  ensureBranch('التقسيط',  'BR-TAQSIT');
} catch (v7BranchSeedErr) {
  console.error('[v7-TRANSFER WARNING] Branch seed:', v7BranchSeedErr.message);
}

// 5. Seed warehouse for التقسيط (idempotent by name+company)
try {
  const wExists = originalPrepare("SELECT id FROM warehouses WHERE name = 'مستودع التقسيط' AND company_id = 1").get();
  if (!wExists) {
    db.prepare("INSERT INTO warehouses (code, name, active, company_id) VALUES ('WH-TAQSIT', 'مستودع التقسيط', 1, 1)").run();
    console.log('[v7-TRANSFER] Seeded warehouse: مستودع التقسيط (WH-TAQSIT)');
  }
} catch (v7WhSeedErr) {
  console.error('[v7-TRANSFER WARNING] Warehouse seed:', v7WhSeedErr.message);
}

// ============================================
// ERP-v8: BRANCH CONTEXT — add branch_type column to branches
// Values: 'retail' | 'wholesale' | 'supplies'
// Visual context only — no business logic.
// ============================================
try {
  const brCols = originalPrepare('PRAGMA table_info(branches)').all().map(c => c.name);
  if (!brCols.includes('branch_type')) {
    db.exec(`ALTER TABLE branches ADD COLUMN branch_type TEXT CHECK(branch_type IN ('retail','wholesale','supplies')) DEFAULT 'retail'`);
    console.log('[v8-CONTEXT] Added branch_type to branches');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_branches_type ON branches(branch_type)`);
  console.log('[v8-CONTEXT] branch_type column ready');
} catch (v8BranchTypeErr) {
  console.error('[v8-CONTEXT WARNING] branch_type migration:', v8BranchTypeErr.message);
}

// ============================================
// ERP-v8: MANUFACTURING ENGINE — indexes + branch type
// ============================================
try {
  // Indexes for production_batches
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_batches_company ON production_batches(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_batches_branch  ON production_batches(branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_batches_status  ON production_batches(status)`);

  // Indexes for production_entries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_entries_batch   ON production_entries(batch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_entries_company ON production_entries(company_id)`);

  // Indexes for production_material_usage
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_mat_batch       ON production_material_usage(batch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_mat_company     ON production_material_usage(company_id)`);

  // Set الجملة branch_type = 'wholesale' (it is the manufacturing branch)
  const jomla = originalPrepare(
    `SELECT id FROM branches WHERE code = 'BR-JOMLA' AND company_id = 1`
  ).get();
  if (jomla) {
    db.prepare(
      `UPDATE branches SET branch_type = 'wholesale' WHERE id = ? AND company_id = 1`
    ).run(jomla.id);
    console.log('[v8-MFG] Set الجملة branch_type = wholesale');
  }

  console.log('[v8-MFG] Manufacturing engine ready (3 tables, 7 indexes)');
} catch (v8MfgErr) {
  console.error('[v8-MFG WARNING] Manufacturing setup:', v8MfgErr.message);
}

// ============================================
// ERP-v9: COLOR SYSTEM + SESSION ENGINE SETUP
// ============================================
try {
  // color_families indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_families_company ON color_families(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_families_active  ON color_families(active)`);

  // color_master indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_master_company   ON color_master(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_master_family    ON color_master(family_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_master_supplier  ON color_master(supplier_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_color_master_active    ON color_master(active)`);

  // artisan_rates indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_artisan_rates_company  ON artisan_rates(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_artisan_rates_artisan  ON artisan_rates(artisan_id)`);

  // production_sessions indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_company  ON production_sessions(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_artisan  ON production_sessions(artisan_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_branch   ON production_sessions(branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_date     ON production_sessions(session_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_status   ON production_sessions(status)`);

  // production_lines indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_lines_session ON production_lines(session_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_lines_color   ON production_lines(color_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_lines_company ON production_lines(company_id)`);

  // Seed default color families for company 1 if none exist
  const existingFamilies = originalPrepare(`SELECT COUNT(*) AS cnt FROM color_families WHERE company_id = 1`).get();
  if (!existingFamilies || existingFamilies.cnt === 0) {
    const seedFamilies = [
      { name: 'أبيض / فاتح', order: 1 },
      { name: 'أصفر / بيج',   order: 2 },
      { name: 'أحمر / وردي',  order: 3 },
      { name: 'أزرق / سماوي', order: 4 },
      { name: 'أخضر',         order: 5 },
      { name: 'بني / بيج',    order: 6 },
      { name: 'رمادي / أسود', order: 7 },
      { name: 'متعدد الألوان',order: 8 }
    ];
    const insertFamily = originalPrepare(
      `INSERT INTO color_families (family_name_ar, display_order, active, company_id) VALUES (?, ?, 1, 1)`
    );
    for (const f of seedFamilies) insertFamily.run(f.name, f.order);
    console.log('[v9-COLOR] Seeded 8 default color families');
  }

  console.log('[v9-COLOR-MFG] Color system + session engine ready (5 tables, 15 indexes)');
} catch (v9Err) {
  console.error('[v9-COLOR-MFG WARNING] Setup:', v9Err.message);
}


// ============================================
// ERP-v10: INVENTORY STAGE MODEL + BRANCH ALIGNMENT
// Aligns data model with real Sabra thread business workflow:
// Raw Bobbins → Wholesale KG → Retail KG → Retail Ounce
// 1 kg = 32 ounces (fixed commercial conversion)
// ============================================
try {
  console.log('[v10-STAGE] Starting inventory stage model migration...');

  // 1. Add branch_id + inventory_stage to warehouses (for existing DBs)
  const whCols = originalPrepare('PRAGMA table_info(warehouses)').all().map(c => c.name);
  if (!whCols.includes('branch_id')) {
    db.exec(`ALTER TABLE warehouses ADD COLUMN branch_id INTEGER REFERENCES branches(id)`);
    console.log('[v10-STAGE] Added branch_id to warehouses');
  }
  if (!whCols.includes('inventory_stage')) {
    db.exec(`ALTER TABLE warehouses ADD COLUMN inventory_stage TEXT CHECK(inventory_stage IN ('raw_bobbin','wholesale_kg','retail_kg','retail_oz','supplies'))`);
    console.log('[v10-STAGE] Added inventory_stage to warehouses');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_warehouses_stage  ON warehouses(inventory_stage)`);

  // 2. Add inventory_stage to inventory table (for existing DBs)
  const invCols = originalPrepare('PRAGMA table_info(inventory)').all().map(c => c.name);
  if (!invCols.includes('inventory_stage')) {
    db.exec(`ALTER TABLE inventory ADD COLUMN inventory_stage TEXT NOT NULL DEFAULT 'wholesale_kg' CHECK(inventory_stage IN ('raw_bobbin','wholesale_kg','retail_kg','retail_oz','supplies'))`);
    console.log('[v10-STAGE] Added inventory_stage to inventory');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_stage ON inventory(inventory_stage)`);

  // 3. Add branch_id to clients + suppliers (for existing DBs)
  const cliCols = originalPrepare('PRAGMA table_info(clients)').all().map(c => c.name);
  if (!cliCols.includes('branch_id')) {
    db.exec(`ALTER TABLE clients ADD COLUMN branch_id INTEGER REFERENCES branches(id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_branch ON clients(branch_id)`);
    console.log('[v10-STAGE] Added branch_id to clients');
  }
  const supCols = originalPrepare('PRAGMA table_info(suppliers)').all().map(c => c.name);
  if (!supCols.includes('branch_id')) {
    db.exec(`ALTER TABLE suppliers ADD COLUMN branch_id INTEGER REFERENCES branches(id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON suppliers(branch_id)`);
    console.log('[v10-STAGE] Added branch_id to suppliers');
  }

  // 4. Add inventory_stage + unit to sale_items (for Phase 4 POS alignment)
  const siCols2 = originalPrepare('PRAGMA table_info(sale_items)').all().map(c => c.name);
  if (!siCols2.includes('inventory_stage')) {
    db.exec(`ALTER TABLE sale_items ADD COLUMN inventory_stage TEXT`);
    console.log('[v10-STAGE] Added inventory_stage to sale_items');
  }
  if (!siCols2.includes('unit')) {
    db.exec(`ALTER TABLE sale_items ADD COLUMN unit TEXT DEFAULT 'kg'`);
    console.log('[v10-STAGE] Added unit to sale_items');
  }

  // 5. Recreate production_sessions to update CHECK constraint (OPEN/CLOSED/APPROVED)
  // Only needed if existing table has old CHECK without APPROVED
  {
    const tblSql = originalPrepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='production_sessions'").get();
    const hasApproved = tblSql && tblSql.sql && tblSql.sql.includes('APPROVED');
    if (hasApproved) {
      console.log('[v10-STAGE] production_sessions already supports APPROVED status');
    } else {
    // CHECK constraint blocks APPROVED — need to recreate table
    console.log('[v10-STAGE] Recreating production_sessions with APPROVED status...');
    db.exec(`PRAGMA foreign_keys = OFF`);
    db.exec(`
      CREATE TABLE production_sessions_v10 (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        session_date          DATE    NOT NULL,
        artisan_id            INTEGER NOT NULL,
        branch_id             INTEGER NOT NULL,
        status                TEXT    NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','APPROVED')),
        total_combinations    INTEGER NOT NULL DEFAULT 0,
        calculated_labor_cost REAL    NOT NULL DEFAULT 0,
        final_labor_cost      REAL    NOT NULL DEFAULT 0,
        labor_modified        INTEGER NOT NULL DEFAULT 0,
        created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        company_id            INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (artisan_id) REFERENCES artisans(id),
        FOREIGN KEY (branch_id)  REFERENCES branches(id)
      )
    `);
    db.exec(`INSERT INTO production_sessions_v10 SELECT * FROM production_sessions`);
    db.exec(`DROP TABLE production_sessions`);
    db.exec(`ALTER TABLE production_sessions_v10 RENAME TO production_sessions`);
    // Recreate indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_company  ON production_sessions(company_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_artisan  ON production_sessions(artisan_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_branch   ON production_sessions(branch_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_date     ON production_sessions(session_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prod_sess_status   ON production_sessions(status)`);
    db.exec(`PRAGMA foreign_keys = ON`);
    console.log('[v10-STAGE] production_sessions recreated with APPROVED status');
    }
  }

  // 6. Seed supplies branch (المواد)
  const suppliesBranch = originalPrepare("SELECT id FROM branches WHERE code = 'BR-SUPPLIES' AND company_id = 1").get();
  if (!suppliesBranch) {
    originalPrepare('INSERT INTO branches (name, code, branch_type, company_id) VALUES (?, ?, ?, 1)')
      .run('المواد', 'BR-SUPPLIES', 'supplies');
    console.log('[v10-STAGE] Seeded supplies branch: المواد (BR-SUPPLIES)');
  }

  // 7. Seed default warehouses per stage with branch linkage
  const jomlaB  = originalPrepare("SELECT id FROM branches WHERE code = 'BR-JOMLA'   AND company_id = 1").get();
  const taqsitB = originalPrepare("SELECT id FROM branches WHERE code = 'BR-TAQSIT'  AND company_id = 1").get();
  const supplyB = originalPrepare("SELECT id FROM branches WHERE code = 'BR-SUPPLIES' AND company_id = 1").get();

  const warehouseSeeds = [
    { code: 'WH-RAW',        name: 'مستودع البكرات الخام',  branchId: jomlaB?.id,  stage: 'raw_bobbin' },
    { code: 'WH-WHOLESALE',  name: 'مستودع الجملة (كجم)',   branchId: jomlaB?.id,  stage: 'wholesale_kg' },
    { code: 'WH-RETAIL-KG',  name: 'مخزن التجزئة (كجم)',     branchId: taqsitB?.id, stage: 'retail_kg' },
    { code: 'WH-RETAIL-OZ',  name: 'رفوف التجزئة (أونصة)',   branchId: taqsitB?.id, stage: 'retail_oz' },
    { code: 'WH-SUPPLIES',   name: 'مستودع اللوازم',          branchId: supplyB?.id, stage: 'supplies' }
  ];

  for (const wh of warehouseSeeds) {
    const exists = originalPrepare("SELECT id FROM warehouses WHERE code = ? AND company_id = 1").get(wh.code);
    if (!exists && wh.branchId) {
      originalPrepare(
        'INSERT INTO warehouses (code, name, branch_id, inventory_stage, active, company_id) VALUES (?, ?, ?, ?, 1, 1)'
      ).run(wh.code, wh.name, wh.branchId, wh.stage);
      console.log(`[v10-STAGE] Seeded warehouse: ${wh.name} (${wh.code}) → stage=${wh.stage}`);
    }
  }

  // 8. Backfill branch_id on existing warehouses that have none
  if (jomlaB) {
    originalPrepare('UPDATE warehouses SET branch_id = ? WHERE branch_id IS NULL AND company_id = 1')
      .run(jomlaB.id);
  }

  // 9. Backfill inventory_stage on existing warehouses that have none
  // Map existing warehouses to their stages
  originalPrepare("UPDATE warehouses SET inventory_stage = 'wholesale_kg' WHERE inventory_stage IS NULL AND company_id = 1").run();

  // 10. Rebuild idx_inventory_unique to include inventory_stage
  // The index needs to differentiate by stage so the same product+color can exist
  // in multiple stages (e.g., retail_kg and retail_oz)
  try {
    const idxCheck = originalPrepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inventory_unique'"
    ).get();
    if (idxCheck) {
      const info = originalPrepare('PRAGMA index_info(idx_inventory_unique)').all();
      // If index has 4 or fewer columns, it's the old schema — needs inventory_stage
      if (info.length <= 4) {
        db.exec(`DROP INDEX idx_inventory_unique`);
        db.exec(`CREATE UNIQUE INDEX idx_inventory_unique ON inventory(
          warehouse_id,
          product_type_id,
          inventory_stage,
          COALESCE(color_code_id, 0),
          LOWER(TRIM(COALESCE(color_description, '')))
        )`);
        console.log('[v10-STAGE] Rebuilt idx_inventory_unique with inventory_stage (5-column)');
      }
    } else {
      db.exec(`CREATE UNIQUE INDEX idx_inventory_unique ON inventory(
        warehouse_id,
        product_type_id,
        inventory_stage,
        COALESCE(color_code_id, 0),
        LOWER(TRIM(COALESCE(color_description, '')))
      )`);
      console.log('[v10-STAGE] Created idx_inventory_unique (5-column)');
    }
  } catch (idxErr) {
    console.error('[v10-STAGE WARNING] idx_inventory_unique rebuild:', idxErr.message);
  }

  console.log('[v10-STAGE] Inventory stage model migration complete');
} catch (v10Err) {
  console.error('[v10-STAGE ERROR] Migration failed:', v10Err.message);
}

// ============================================================
// PHASE 6: MANUFACTURING PRODUCTION FLOW
// - Add started_at, closed_at to production_sessions
// - Create worker_transactions table + indexes
// ============================================================
try {
  const psCols = db.prepare('PRAGMA table_info(production_sessions)').all().map(c => c.name);
  if (!psCols.includes('started_at')) {
    db.exec('ALTER TABLE production_sessions ADD COLUMN started_at DATETIME');
    console.log('[PHASE6] Added started_at to production_sessions');
  }
  if (!psCols.includes('closed_at')) {
    db.exec('ALTER TABLE production_sessions ADD COLUMN closed_at DATETIME');
    console.log('[PHASE6] Added closed_at to production_sessions');
  }

  // worker_transactions already created by schema.sql IF NOT EXISTS;
  // just ensure indexes exist here.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_worker_tx_worker  ON worker_transactions(worker_id, company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_worker_tx_session ON worker_transactions(session_id)`);
  console.log('[PHASE6] worker_transactions indexes ready');
} catch (p6Err) {
  console.error('[PHASE6 WARNING] Migration error:', p6Err.message);
}

// ============================================================
// v11: COLOR ARCHITECTURE UNIFICATION
// Adds canonical `colors` table + color_id FK columns.
// Backfills existing color_codes and color_master rows.
// ============================================================
try {
  // 1. Create colors table (schema already has CREATE IF NOT EXISTS — belt + suspenders)
  db.exec(`
    CREATE TABLE IF NOT EXISTS colors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id  INTEGER NOT NULL REFERENCES color_families(id),
      name_ar    TEXT    NOT NULL,
      hex_code   TEXT,
      company_id INTEGER NOT NULL DEFAULT 1
    )
  `);

  // 2. Add visual_color to color_families
  const cfCols = db.prepare('PRAGMA table_info(color_families)').all().map(c => c.name);
  if (!cfCols.includes('visual_color')) {
    db.exec('ALTER TABLE color_families ADD COLUMN visual_color TEXT');
    console.log('[v11-COLORS] Added visual_color to color_families');
  }

  // 3. Add color_id to color_codes
  const ccCols = db.prepare('PRAGMA table_info(color_codes)').all().map(c => c.name);
  if (!ccCols.includes('color_id')) {
    db.exec('ALTER TABLE color_codes ADD COLUMN color_id INTEGER REFERENCES colors(id)');
    console.log('[v11-COLORS] Added color_id to color_codes');
  }

  // 4. Add color_id to color_master
  const cmCols = db.prepare('PRAGMA table_info(color_master)').all().map(c => c.name);
  if (!cmCols.includes('color_id')) {
    db.exec('ALTER TABLE color_master ADD COLUMN color_id INTEGER REFERENCES colors(id)');
    console.log('[v11-COLORS] Added color_id to color_master');
  }

  // 5. Indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_colors_company    ON colors(company_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_colors_family     ON colors(family_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_color_codes_colid ON color_codes(color_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_color_master_colid ON color_master(color_id)');

  // 6. Backfill: create colors rows from existing color_codes + color_master
  const backfillV11 = db.transaction(() => {
    // Ensure default "غير مصنف" family exists for company 1
    let defaultFamily = db.prepare(
      `SELECT id FROM color_families WHERE family_name_ar = ? AND company_id = 1`
    ).get('غير مصنف');
    if (!defaultFamily) {
      const fr = db.prepare(
        `INSERT INTO color_families (family_name_ar, display_order, active, company_id) VALUES (?, 999, 1, 1)`
      ).run('غير مصنف');
      defaultFamily = { id: fr.lastInsertRowid };
    }

    // Backfill color_codes
    const ccRows = db.prepare('SELECT * FROM color_codes WHERE color_id IS NULL').all();
    for (const cc of ccRows) {
      const cid = cc.company_id || 1;
      const colorName = cc.main_color || cc.code;
      let colorRow = db.prepare(
        'SELECT id FROM colors WHERE name_ar = ? AND company_id = ?'
      ).get(colorName, cid);
      if (!colorRow) {
        const cr = db.prepare(
          'INSERT INTO colors (family_id, name_ar, hex_code, company_id) VALUES (?, ?, NULL, ?)'
        ).run(defaultFamily.id, colorName, cid);
        colorRow = { id: cr.lastInsertRowid };
      }
      db.prepare('UPDATE color_codes SET color_id = ? WHERE id = ?').run(colorRow.id, cc.id);
    }

    // Backfill color_master
    const cmRows = db.prepare('SELECT * FROM color_master WHERE color_id IS NULL').all();
    for (const cm of cmRows) {
      const cid = cm.company_id || 1;
      const familyId = cm.family_id || defaultFamily.id;
      let colorRow = db.prepare(
        'SELECT id FROM colors WHERE name_ar = ? AND company_id = ?'
      ).get(cm.internal_ar_name, cid);
      if (!colorRow) {
        const cr = db.prepare(
          'INSERT INTO colors (family_id, name_ar, hex_code, company_id) VALUES (?, ?, ?, ?)'
        ).run(familyId, cm.internal_ar_name, cm.hex_code || null, cid);
        colorRow = { id: cr.lastInsertRowid };
      } else if (cm.hex_code) {
        db.prepare('UPDATE colors SET hex_code = ? WHERE id = ? AND hex_code IS NULL')
          .run(cm.hex_code, colorRow.id);
      }
      db.prepare('UPDATE color_master SET color_id = ? WHERE id = ?').run(colorRow.id, cm.id);
    }

    return { cc: ccRows.length, cm: cmRows.length };
  });

  const v11Result = backfillV11();
  if (v11Result.cc > 0 || v11Result.cm > 0) {
    console.log(`[v11-COLORS] Backfilled ${v11Result.cc} color_codes, ${v11Result.cm} color_master rows`);
  }
  console.log('[v11-COLORS] Color architecture unification complete');
} catch (v11Err) {
  console.error('[v11-COLORS ERROR] Migration failed:', v11Err.message);
}

// ============================================
// v12: PROMISSORY NOTES (TRAITES)
// Idempotent: check for table existence first.
// ============================================
try {
  const traitesExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='traites'").get();
  if (!traitesExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS traites (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        reference   TEXT,
        client_id   INTEGER REFERENCES clients(id),
        amount      REAL    NOT NULL DEFAULT 0,
        due_date    TEXT    NOT NULL,
        status      TEXT    NOT NULL DEFAULT 'PENDING'
                      CHECK(status IN ('PENDING','COLLECTED','UNPAID')),
        notes       TEXT,
        company_id  INTEGER NOT NULL DEFAULT 1,
        branch_id   INTEGER,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[v12-TRAITES] Created traites table');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traites_company    ON traites(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traites_client     ON traites(client_id, company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traites_due_date   ON traites(due_date, company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traites_status     ON traites(status, company_id)`);
  console.log('[v12-TRAITES] Promissory notes (traites) ready');
} catch (v12Err) {
  console.error('[v12-TRAITES ERROR] Migration failed:', v12Err.message);
}

// ============================================
// v13 — ARTISAN MANAGEMENT: add branch_id to artisans
// Allows assigning each artisan to a branch (optional).
// ============================================
try {
  const artisanCols = db.prepare('PRAGMA table_info(artisans)').all().map(c => c.name);
  if (!artisanCols.includes('branch_id')) {
    db.exec('ALTER TABLE artisans ADD COLUMN branch_id INTEGER REFERENCES branches(id)');
    console.log('[v13-ARTISANS] Added branch_id to artisans');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_artisans_branch   ON artisans(branch_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_artisans_company  ON artisans(company_id)');
  console.log('[v13-ARTISANS] Artisan branch assignment ready');
} catch (v13Err) {
  console.error('[v13-ARTISANS ERROR]', v13Err.message);
}

// ============================================
// v14: MANUFACTURING MODEL UPDATE
// - rate_per_kg on artisan_rates (labor = kg × rate, not combinations × rate)
// - line_status on production_lines (completed vs unfinished)
// - total_kg_produced on production_sessions
// - CANCELLED added to valid statuses (SQLite can't ALTER CHECK constraints)
// ============================================
try {
  const arCols = db.prepare('PRAGMA table_info(artisan_rates)').all().map(c => c.name);
  if (!arCols.includes('rate_per_kg')) {
    db.exec('ALTER TABLE artisan_rates ADD COLUMN rate_per_kg REAL NOT NULL DEFAULT 0');
    db.exec('UPDATE artisan_rates SET rate_per_kg = rate_per_combination');
    console.log('[v14-MFG] Added rate_per_kg to artisan_rates, copied from rate_per_combination');
  }
  const plCols = db.prepare('PRAGMA table_info(production_lines)').all().map(c => c.name);
  if (!plCols.includes('line_status')) {
    db.exec("ALTER TABLE production_lines ADD COLUMN line_status TEXT NOT NULL DEFAULT 'completed'");
    console.log('[v14-MFG] Added line_status to production_lines');
  }
  const psCols = db.prepare('PRAGMA table_info(production_sessions)').all().map(c => c.name);
  if (!psCols.includes('total_kg_produced')) {
    db.exec('ALTER TABLE production_sessions ADD COLUMN total_kg_produced REAL NOT NULL DEFAULT 0');
    console.log('[v14-MFG] Added total_kg_produced to production_sessions');
  }
  if (!psCols.includes('closed_at')) {
    db.exec('ALTER TABLE production_sessions ADD COLUMN closed_at DATETIME');
    console.log('[v14-MFG] Added closed_at to production_sessions');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_pl_session_status ON production_lines(session_id, line_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pl_color         ON production_lines(color_id, company_id)');
  console.log('[v14-MFG] Manufacturing model v14 ready');
} catch (v14Err) {
  console.error('[v14-MFG ERROR]', v14Err.message);
}

// ── v15: PRODUCTION WORKFLOW REDESIGN ─────────────────────────────────────────
// Separates delivery (assign combinations) from receiving (confirm produced KG)
// New line_status values: in_progress | completed | cancelled | transferred
// 'unfinished' (v14) renamed to 'in_progress'; 'completed' unchanged.
// Two new transfer-tracking columns added.
try {
  db.exec("UPDATE production_lines SET line_status='in_progress' WHERE line_status='unfinished'");
  const plCols15 = db.prepare('PRAGMA table_info(production_lines)').all().map(c => c.name);
  if (!plCols15.includes('transferred_to_session_id')) {
    db.exec('ALTER TABLE production_lines ADD COLUMN transferred_to_session_id INTEGER');
  }
  if (!plCols15.includes('transferred_from_line_id')) {
    db.exec('ALTER TABLE production_lines ADD COLUMN transferred_from_line_id INTEGER');
  }
  console.log('[v15-WORKFLOW] Production workflow redesign migration complete');
} catch (v15Err) {
  console.error('[v15-WORKFLOW ERROR]', v15Err.message);
}

// ── v16: PER-LINE RATE + PRIOR KG ─────────────────────────────────────────────
// rate_per_kg: per-line labor rate (replaces session-level artisan_rates lookup)
// prior_produced_kg: KG produced by previous artisan before this line was transferred
try {
  const plCols16 = db.prepare('PRAGMA table_info(production_lines)').all().map(c => c.name);
  if (!plCols16.includes('rate_per_kg')) {
    db.exec('ALTER TABLE production_lines ADD COLUMN rate_per_kg REAL NOT NULL DEFAULT 6');
    db.exec(`
      UPDATE production_lines SET rate_per_kg = COALESCE(
        (SELECT ar.rate_per_kg FROM artisan_rates ar
         JOIN production_sessions ps ON ps.artisan_id = ar.artisan_id AND ps.company_id = ar.company_id
         WHERE ps.id = production_lines.session_id AND ps.company_id = production_lines.company_id
         LIMIT 1), 6)
    `);
  }
  if (!plCols16.includes('prior_produced_kg')) {
    db.exec('ALTER TABLE production_lines ADD COLUMN prior_produced_kg REAL NOT NULL DEFAULT 0');
  }
  console.log('[v16-LABOR] Per-line rate_per_kg and prior_produced_kg ready');
} catch (v16Err) {
  console.error('[v16-LABOR ERROR]', v16Err.message);
}

// ── v17: WAREHOUSE ARCHIVED FLAG ───────────────────────────────────────────────
// Adds 'archived' flag to warehouses so legacy/unused warehouses are hidden from UI.
// Archives any warehouse that is NOT one of the 5 canonical seeded warehouses
// AND has no inventory with quantity > 0 (safe to hide).
try {
  const wh17 = db.prepare('PRAGMA table_info(warehouses)').all().map(c => c.name);
  if (!wh17.includes('archived')) {
    db.exec('ALTER TABLE warehouses ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
    db.exec(`
      UPDATE warehouses SET archived = 1
      WHERE code NOT IN ('WH-RAW','WH-WHOLESALE','WH-RETAIL-KG','WH-RETAIL-OZ','WH-SUPPLIES')
        AND id NOT IN (SELECT DISTINCT warehouse_id FROM inventory WHERE quantity > 0)
    `);
  }
  console.log('[v17-WAREHOUSE] archived column ready');
} catch (v17Err) {
  console.error('[v17-WAREHOUSE ERROR]', v17Err.message);
}

// ============================================
// MIGRATION v18: inventory_movements — add stage tracking columns
// Adds: inventory_stage, warehouse_id, branch_id, color_id, product_id
// These allow COGS calculation and stage-level movement analysis.
// user-requested structural improvements (2026-03-11).
// ============================================
try {
  const imCols = db.prepare('PRAGMA table_info(inventory_movements)').all().map(c => c.name);
  const imAlter = [
    { col: 'inventory_stage', ddl: `ALTER TABLE inventory_movements ADD COLUMN inventory_stage TEXT` },
    { col: 'warehouse_id',    ddl: `ALTER TABLE inventory_movements ADD COLUMN warehouse_id INTEGER` },
    { col: 'branch_id',       ddl: `ALTER TABLE inventory_movements ADD COLUMN branch_id INTEGER` },
    { col: 'color_id',        ddl: `ALTER TABLE inventory_movements ADD COLUMN color_id INTEGER` },
    { col: 'product_id',      ddl: `ALTER TABLE inventory_movements ADD COLUMN product_id INTEGER` },
  ];
  for (const { col, ddl } of imAlter) {
    if (!imCols.includes(col)) {
      db.exec(ddl);
      console.log(`[v18-INV-MOVE] Added ${col} to inventory_movements`);
    }
  }
  // Backfill inventory_stage, warehouse_id, branch_id, color_id, product_id from inventory table
  db.prepare(`
    UPDATE inventory_movements
    SET
      inventory_stage = (SELECT i.inventory_stage FROM inventory i WHERE i.id = inventory_movements.inventory_id),
      warehouse_id    = (SELECT i.warehouse_id    FROM inventory i WHERE i.id = inventory_movements.inventory_id),
      branch_id       = (SELECT w.branch_id FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.id = inventory_movements.inventory_id),
      color_id        = (SELECT i.master_color_id FROM inventory i WHERE i.id = inventory_movements.inventory_id),
      product_id      = (SELECT i.product_type_id FROM inventory i WHERE i.id = inventory_movements.inventory_id)
    WHERE inventory_stage IS NULL OR warehouse_id IS NULL
  `).run();
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inv_move_stage      ON inventory_movements(inventory_stage)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inv_move_warehouse  ON inventory_movements(warehouse_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inv_move_branch     ON inventory_movements(branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inv_move_product    ON inventory_movements(product_id)`);
  console.log('[v18-INV-MOVE] inventory_movements stage columns and indexes ready');
} catch (v18Err) {
  console.error('[v18-INV-MOVE ERROR]', v18Err.message);
}

// ============================================
// MIGRATION v18b: Tailoring module — CREATE tables + indexes
// Tables are already defined in schema.js (CREATE IF NOT EXISTS).
// This block only adds indexes and any idempotent column additions.
// ============================================
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_orders_company  ON tailoring_orders(company_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_orders_branch   ON tailoring_orders(branch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_orders_client   ON tailoring_orders(client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_orders_status   ON tailoring_orders(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_garments_order  ON tailoring_garments(order_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_services_garment ON tailoring_services(garment_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tailoring_services_artisan ON tailoring_services(artisan_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_garment_materials_garment ON garment_materials(garment_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_garment_materials_wh      ON garment_materials(warehouse_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_catalog_company   ON service_catalog(company_id)`);
  console.log('[v18b-TAILORING] Tailoring module indexes ready');
} catch (v18bErr) {
  console.error('[v18b-TAILORING ERROR]', v18bErr.message);
}

// ============================================
// MIGRATION v19: BRANCH is_active FLAG
// Adds is_active column to branches table.
// الفرع الرئيسي (code BR-001) is the legacy head-branch
// entry — it is not a real operational branch and must NOT
// appear in the login dropdown.  Mark it inactive (0).
// All three operational branches remain active (1).
// ============================================
try {
  const br19Cols = originalPrepare('PRAGMA table_info(branches)').all().map(c => c.name);
  if (!br19Cols.includes('is_active')) {
    db.exec('ALTER TABLE branches ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    console.log('[v19-BRANCH-ACTIVE] Added is_active column to branches');
  }
  // Mark الفرع الرئيسي as inactive (it is the head-office placeholder, not an operational branch)
  db.prepare(
    `UPDATE branches SET is_active = 0 WHERE code = 'BR-001' AND company_id = 1`
  ).run();
  console.log('[v19-BRANCH-ACTIVE] الفرع الرئيسي (BR-001) marked inactive — 3 operational branches remain');
} catch (v19Err) {
  console.error('[v19-BRANCH-ACTIVE ERROR]', v19Err.message);
}


// ============================================
// MIGRATION v20: RENAME SUPPLIES BRANCH
// Renames 'المواد' to 'لوازم الخياطة' to reflect
// the correct business name of the sewing supplies branch.
// ============================================
try {
  db.prepare(
    `UPDATE branches SET name = 'لوازم الخياطة' WHERE branch_type = 'supplies' AND company_id = 1`
  ).run();
  console.log('[v20-BRANCH-RENAME] Sewing supplies branch renamed to لوازم الخياطة');
} catch (v20Err) {
  console.error('[v20-BRANCH-RENAME ERROR]', v20Err.message);
}

// ============================================
// MIGRATION v21: BRANCH ISOLATION FOR CLIENTS
// Adds branch_id column to clients table so that
// each branch sees only its own client records.
// Existing clients are backfilled to the retail branch.
// ============================================
try {
  const cli21Cols = originalPrepare('PRAGMA table_info(clients)').all().map(c => c.name);
  if (!cli21Cols.includes('branch_id')) {
    db.exec('ALTER TABLE clients ADD COLUMN branch_id INTEGER DEFAULT NULL');
    console.log('[v21-CLIENT-BRANCH] Added branch_id column to clients');
  }
  // Backfill — assign existing clients to the retail branch (التقسيط)
  const retailBranch = db.prepare(
    `SELECT id FROM branches WHERE branch_type = 'retail' AND company_id = 1 LIMIT 1`
  ).get();
  if (retailBranch) {
    const updated = db.prepare(
      `UPDATE clients SET branch_id = ? WHERE branch_id IS NULL AND company_id = 1`
    ).run(retailBranch.id);
    if (updated.changes > 0)
      console.log(`[v21-CLIENT-BRANCH] Backfilled ${updated.changes} clients → retail branch`);
  }
  console.log('[v21-CLIENT-BRANCH] Client branch isolation ready');
} catch (v21Err) {
  console.error('[v21-CLIENT-BRANCH ERROR]', v21Err.message);
}

// ============================================
// MIGRATION v22: BRANCH ISOLATION FOR SUPPLIERS
// Adds branch_id column to suppliers table so that
// each branch sees only its own supplier records.
// Existing suppliers are backfilled to the wholesale branch.
// ============================================
try {
  const sup22Cols = originalPrepare('PRAGMA table_info(suppliers)').all().map(c => c.name);
  if (!sup22Cols.includes('branch_id')) {
    db.exec('ALTER TABLE suppliers ADD COLUMN branch_id INTEGER DEFAULT NULL');
    console.log('[v22-SUPPLIER-BRANCH] Added branch_id column to suppliers');
  }
  // Backfill — assign existing suppliers to the wholesale branch (الجملة)
  const wholesaleBranch = db.prepare(
    `SELECT id FROM branches WHERE branch_type = 'wholesale' AND company_id = 1 LIMIT 1`
  ).get();
  if (wholesaleBranch) {
    const updated = db.prepare(
      `UPDATE suppliers SET branch_id = ? WHERE branch_id IS NULL AND company_id = 1`
    ).run(wholesaleBranch.id);
    if (updated.changes > 0)
      console.log(`[v22-SUPPLIER-BRANCH] Backfilled ${updated.changes} suppliers → wholesale branch`);
  }
  console.log('[v22-SUPPLIER-BRANCH] Supplier branch isolation ready');
} catch (v22Err) {
  console.error('[v22-SUPPLIER-BRANCH ERROR]', v22Err.message);
}

// ============================================
// MIGRATION v23: STRICT BRANCH ISOLATION (PHASE 2 & 3)
// Enforces branch_id on all operational tables and backfills historical data
// to the Wholesale Sabra branch.
// Also adds user status and branch_id.
// ============================================
try {
  // 1. User table enhancements
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userCols.includes('status')) {
    db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
    console.log('[v23-STRICT-ISOLATION] Added status to users');
  }
  if (!userCols.includes('branch_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)`);
    console.log('[v23-STRICT-ISOLATION] Added branch_id to users');
  }

  // 1.5 Recreate users table to allow 'owner' role without blowing up
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (tableInfo && tableInfo.sql.includes("CHECK(role IN ('ADMIN','STAFF'))")) {
      db.exec('PRAGMA foreign_keys=off;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          username      TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role          TEXT NOT NULL CHECK(role IN ('ADMIN','STAFF','owner','OWNER')),
          company_id    INTEGER NOT NULL,
          status        TEXT    DEFAULT 'active',
          branch_id     INTEGER REFERENCES branches(id),
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(company_id) REFERENCES companies(id)
        );
      `);
      db.exec(`INSERT INTO users_new (id, username, password_hash, role, company_id, status, branch_id, created_at) SELECT id, username, password_hash, role, company_id, status, branch_id, created_at FROM users;`);
      db.exec(`DROP TABLE users;`);
      db.exec(`ALTER TABLE users_new RENAME TO users;`);
      db.exec('PRAGMA foreign_keys=on;');
      console.log('[v23-STRICT-ISOLATION] Recreated users table to relax role check constraint');
    }
  } catch(e) { console.error('[v23-STRICT-ISOLATION WARNING] users table recreation for roles:', e.message); }

  // Set system admin to 'owner' role
  db.prepare(`UPDATE users SET role = 'owner' WHERE username = 'admin'`).run();

  // 2. Add branch_id to remaining operational tables
  const targetTables = [
    'sales', 'purchases', 'journal_entries', 'artisans', 'artisan_services',
    'sales_payments', 'special_orders', 'purchases_items', 'purchases_payments',
    'inventory', 'inventory_movements', 'journal_lines', 'treasury_ledger',
    'expenses', 'opening_balances', 'checks_portfolio', 'checks_issued',
    'manufacturing_orders', 'artisan_accounts', 'tailoring_garments',
    'tailoring_services', 'garment_materials', 'service_catalog'
  ];

  targetTables.forEach(table => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      if (cols.length > 0 && !cols.includes('branch_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN branch_id INTEGER REFERENCES branches(id)`);
        console.log(`[v23-STRICT-ISOLATION] Added branch_id to ${table}`);
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_branch ON ${table}(branch_id)`);
    } catch (err) {
      console.error(`[v23-STRICT-ISOLATION WARNING] ${table}:`, err.message);
    }
  });

  // 3. Phase 3: Data Backfill to Wholesale Branch
  console.log('[v23-STRICT-ISOLATION] Starting Phase 3 Data Backfill...');
  const wholesaleBranch = db.prepare(`SELECT id FROM branches WHERE branch_type = 'wholesale' AND company_id = 1 LIMIT 1`).get();
  
  if (wholesaleBranch) {
    const wholesaleId = wholesaleBranch.id;
    
    // Some tables were previously added with DEFAULT 1. Branch 1 is inactive 'الفرع الرئيسي'.
    // We should safely re-assign them to Wholesale.
    const allOperational = [
      'sales', 'sales_payments', 'special_orders', 'purchases', 'purchases_items', 'purchases_payments',
      'inventory', 'inventory_movements', 'journal_entries', 'journal_lines', 'treasury_ledger',
      'expenses', 'opening_balances', 'checks_portfolio', 'checks_issued', 'manufacturing_orders',
      'artisans', 'artisan_accounts', 'tailoring_garments', 'tailoring_services', 'garment_materials',
      'service_catalog', 'users', 'warehouses'
    ]; // 'clients' and 'suppliers' handled deliberately in v21/v22

    allOperational.forEach(table => {
      try {
        db.prepare(`UPDATE ${table} SET branch_id = ? WHERE branch_id IS NULL`).run(wholesaleId);
        // Specifically fix backfill from previously erroneous defaults (if 1 is the inactive office)
        db.prepare(`UPDATE ${table} SET branch_id = ? WHERE branch_id = 1 AND branch_id != ?`).run(wholesaleId, wholesaleId);
      } catch (err) {
        // Suppress errors for tables that might not have the column yet or where it fails
      }
    });
    console.log(`[v23-STRICT-ISOLATION] Backfilled historical records to Wholesale Sabra (ID: ${wholesaleId})`);
  } else {
    console.error(`[v23-STRICT-ISOLATION] ERROR: Wholesale branch not found, skipping backfill.`);
  }

} catch (v23Err) {
  console.error('[v23-STRICT-ISOLATION ERROR]', v23Err.message);
}

}

module.exports = { runMigrations };


