const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './database/accounting.db';

['database', 'logs', 'backups'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ============================================
// CORRECTED SCHEMA v2.1 - Based on Critical Review
// ============================================

const schema = `
-- Core entities
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0,
  allow_credit INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COLOR CODES (BACKBONE)
CREATE TABLE IF NOT EXISTS color_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  main_color TEXT NOT NULL,
  shade TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INVENTORY SYSTEM
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL,
  product_type_id INTEGER NOT NULL,
  color_code_id INTEGER,
  color_description TEXT,
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  min_quantity REAL DEFAULT 0,
  opening_balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

-- ARTISANS & MANUFACTURING
CREATE TABLE IF NOT EXISTS artisans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  craft_type TEXT,
  daily_expense REAL,
  weekly_expense REAL,
  account_balance REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  overhead_rate REAL DEFAULT 0.10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artisan_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id INTEGER NOT NULL,
  service_type_id INTEGER NOT NULL,
  rate REAL NOT NULL,
  rate_unit TEXT DEFAULT 'كيلو',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (service_type_id) REFERENCES service_types(id),
  UNIQUE(artisan_id, service_type_id)
);

CREATE TABLE IF NOT EXISTS manufacturing_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  service_type_id INTEGER NOT NULL,
  artisan_id INTEGER NOT NULL,
  labor_cost_per_unit REAL DEFAULT 6,
  status TEXT DEFAULT 'قيد_التحضير',
  total_material_cost REAL DEFAULT 0,
  total_labor_cost REAL DEFAULT 0,
  overhead_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  -- TDWAR specific fields
  number_of_compositions INTEGER DEFAULT 0,
  bobbins_used INTEGER DEFAULT 0,
  total_produced_kg REAL DEFAULT 0,
  number_of_bags INTEGER DEFAULT 0,
  avg_kg_per_bag REAL DEFAULT 0,
  notes TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_type_id) REFERENCES service_types(id),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

CREATE TABLE IF NOT EXISTS manufacturing_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL,
  quantity_used REAL NOT NULL,
  expected_output_quantity REAL,
  actual_output_quantity REAL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  waste_quantity REAL DEFAULT 0,
  extraction_rate REAL,
  status TEXT DEFAULT 'قيد_التحضير',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

CREATE TABLE IF NOT EXISTS manufacturing_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  manufacturing_input_id INTEGER,
  output_inventory_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (manufacturing_input_id) REFERENCES manufacturing_inputs(id),
  FOREIGN KEY (output_inventory_id) REFERENCES inventory(id)
);

-- COLOR COMBINATIONS per TDWAR order (multiple colors in one order)
CREATE TABLE IF NOT EXISTS tdwar_color_combinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  bobine_inventory_id INTEGER NOT NULL,
  color_code_id INTEGER,
  number_of_compositions INTEGER NOT NULL,
  bobbins_used INTEGER NOT NULL,
  total_produced_kg REAL DEFAULT 0,
  expected_output_kg REAL,
  status TEXT DEFAULT 'قيد_الإنتاج',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (bobine_inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id)
);

-- PRODUCTION BAGS (JAAB/Khansha Tracking for TDWAR)
-- Waste calculated ONLY when closed (date_returned is set)
CREATE TABLE IF NOT EXISTS production_bags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  artisan_id INTEGER NOT NULL,
  jaab_inventory_id INTEGER,
  color_code_id INTEGER,
  date_given DATE NOT NULL,
  date_returned DATE,
  status TEXT DEFAULT 'مفتوحة',
  expected_output_kg REAL DEFAULT 26,
  total_produced_kg REAL DEFAULT 0,
  waste_kg REAL,
  yield_classification TEXT,
  closed_by_next_bag INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (jaab_inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id)
);

-- PRODUCTION ENTRIES (Daily production records)
CREATE TABLE IF NOT EXISTS production_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  production_bag_id INTEGER,
  artisan_id INTEGER NOT NULL,
  date DATE NOT NULL,
  quantity_kg REAL NOT NULL,
  output_inventory_id INTEGER NOT NULL,
  color_code_id INTEGER,
  unit_price REAL DEFAULT 6,
  artisan_amount REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (production_bag_id) REFERENCES production_bags(id),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (output_inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id)
);

CREATE TABLE IF NOT EXISTS artisan_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id INTEGER NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

-- SALES
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  client_id INTEGER,
  client_name TEXT,
  client_phone TEXT,
  subtotal REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  final_amount REAL NOT NULL,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS sales_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  inventory_id INTEGER,
  product_name TEXT NOT NULL,
  color_code_id INTEGER,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  is_special_order INTEGER DEFAULT 0,
  special_order_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id),
  FOREIGN KEY (special_order_id) REFERENCES special_orders(id)
);

CREATE TABLE IF NOT EXISTS sales_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  check_number TEXT,
  check_date DATE,
  check_due_date DATE,
  bank TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS special_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  sale_id INTEGER,
  date DATE NOT NULL,
  client_id INTEGER,
  client_name TEXT,
  client_phone TEXT NOT NULL,
  color_code_id INTEGER,
  temp_color_description TEXT,
  service_type_id INTEGER,
  quantity REAL NOT NULL,
  unit_price REAL,
  total_price REAL,
  status TEXT DEFAULT 'قيد_التحضير',
  manufacturing_order_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id),
  FOREIGN KEY (service_type_id) REFERENCES service_types(id),
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id)
);

-- PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  supplier_id INTEGER,
  supplier_name TEXT,
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchases_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

CREATE TABLE IF NOT EXISTS purchases_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  check_number TEXT,
  check_date DATE,
  check_due_date DATE,
  bank TEXT,
  source_check_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (source_check_id) REFERENCES checks_portfolio(id)
);

-- CHECKS MANAGEMENT
CREATE TABLE IF NOT EXISTS checks_portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  from_client TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date DATE NOT NULL,
  bank TEXT NOT NULL,
  status TEXT DEFAULT 'معلق',
  source TEXT DEFAULT 'مستلم',
  used_for_payment INTEGER DEFAULT 0,
  deposited_date DATE,
  endorsed_to TEXT,
  endorsed_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checks_issued (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  received_date DATE,
  check_owner TEXT,
  to_supplier TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date DATE NOT NULL,
  bank TEXT NOT NULL,
  status TEXT DEFAULT 'معلق',
  type TEXT DEFAULT 'شيكاتي',
  source_check_id INTEGER,
  paid_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_check_id) REFERENCES checks_portfolio(id)
);

-- TREASURY as LEDGER (read-only via transactions)
CREATE TABLE IF NOT EXISTS treasury_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  account TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  salary REAL NOT NULL,
  phone TEXT,
  hire_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_tours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  city TEXT NOT NULL,
  sales REAL NOT NULL,
  expenses REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opening_balances (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cash REAL DEFAULT 0,
  bank REAL DEFAULT 0,
  fiscal_year INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  user TEXT NOT NULL,
  reason TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PARTNERS & PROFIT DISTRIBUTION
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  share_percent REAL NOT NULL,
  initial_capital REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profit_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER NOT NULL,
  partner_id INTEGER NOT NULL,
  net_profit REAL NOT NULL,
  share_percent REAL NOT NULL,
  share_amount REAL NOT NULL,
  distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
);

INSERT OR IGNORE INTO opening_balances (id, cash, bank, fiscal_year) VALUES (1, 0, 0, 2026);
`;

db.exec(schema);

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

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), version: 'ERP-v2.1-CORRECTED' });
});

// Audit logging
function logAudit(table, recordId, action, oldValues, newValues, user, reason = '') {
  try {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(table, recordId, action, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, user || 'system', reason);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// Treasury ledger entry (append-only)
function addTreasuryEntry(date, type, description, amount, account, refType, refId, user) {
  try {
    db.prepare(`
      INSERT INTO treasury_ledger (date, type, description, amount, account, reference_type, reference_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(date, type, description, amount, account, refType, refId, user || 'system');
  } catch (err) {
    console.error('Treasury entry error:', err);
    throw err;
  }
}

// ============================================
// AUTO-GENERATE CODES (v2.1)
// ============================================
const CODE_PREFIXES = {
  clients: { prefix: 'CLI', start: 1000 },
  suppliers: { prefix: 'SUP', start: 2000 },
  warehouses: { prefix: 'WH', start: 4000 },
  product_types: { prefix: 'PRD', start: 5000 },
  service_types: { prefix: 'SRV', start: 6000 },
  artisans: { prefix: 'ART', start: 7000 },
  employees: { prefix: 'EMP', start: 8000 },
  partners: { prefix: 'PTR', start: 9000 }
};

function generateCode(table) {
  const config = CODE_PREFIXES[table];
  if (!config) return null;

  const lastRecord = db.prepare(`SELECT code FROM ${table} WHERE code LIKE '${config.prefix}%' ORDER BY id DESC LIMIT 1`).get();

  if (lastRecord && lastRecord.code) {
    const lastNum = parseInt(lastRecord.code.replace(config.prefix, '')) || config.start;
    return `${config.prefix}${lastNum + 1}`;
  }
  return `${config.prefix}${config.start}`;
}

// Generic CRUD with audit
function crudWithAudit(table) {
  // Fields to exclude from database insertion (used for audit only)
  const excludeFields = ['id', 'user', 'reason'];

  return {
    all: () => db.prepare(`SELECT * FROM ${table}`).all(),
    get: (id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id),
    create: (data, user) => {
      const keys = Object.keys(data).filter(k => !excludeFields.includes(k));
      const vals = keys.map(k => data[k]);
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const result = db.prepare(sql).run(...vals);
      logAudit(table, result.lastInsertRowid, 'create', null, data, user);
      return result;
    },
    update: (id, data, user, reason) => {
      const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      const keys = Object.keys(data).filter(k => !excludeFields.includes(k));
      const vals = keys.map(k => data[k]);
      const sql = `UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(',')} WHERE id = ?`;
      const result = db.prepare(sql).run(...vals, id);
      logAudit(table, id, 'update', old, data, user, reason);
      return result;
    },
    delete: (id, user, reason) => {
      const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      logAudit(table, id, 'delete', old, null, user, reason);
      return result;
    }
  };
}

// ============================================
// API ENDPOINTS - COLOR CODES
// ============================================

const colorCodes = crudWithAudit('color_codes');

app.get('/api/color-codes', (req, res) => {
  try { res.json(colorCodes.all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/color-codes', (req, res) => {
  try {
    const result = colorCodes.create(req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/color-codes/:id', (req, res) => {
  try {
    colorCodes.update(req.params.id, req.body, req.body.user || 'system', req.body.reason);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/color-codes/:id', (req, res) => {
  try {
    colorCodes.delete(req.params.id, req.body.user || 'system', req.body.reason);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - WAREHOUSES & PRODUCT TYPES
// ============================================

const warehouses = crudWithAudit('warehouses');
const productTypes = crudWithAudit('product_types');

app.get('/api/warehouses', (req, res) => {
  try { res.json(warehouses.all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/warehouses', (req, res) => {
  try {
    const code = generateCode('warehouses');
    const data = { ...req.body, code };
    const result = warehouses.create(data, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/warehouses/:id', (req, res) => {
  try {
    warehouses.delete(req.params.id, req.body.user || 'system', req.body.reason);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/product-types', (req, res) => {
  try { res.json(productTypes.all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/product-types', (req, res) => {
  try {
    const code = generateCode('product_types');
    const data = { ...req.body, code };
    const result = productTypes.create(data, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/product-types/:id', (req, res) => {
  try {
    productTypes.delete(req.params.id, req.body.user || 'system', req.body.reason);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - INVENTORY
// ============================================

app.get('/api/inventory', (req, res) => {
  try {
    const inventory = db.prepare(`
      SELECT i.*, w.name as warehouse_name, pt.name as product_name, pt.category, pt.unit,
             cc.code as color_code, cc.main_color, cc.shade,
             COALESCE(cc.code, i.color_description, 'بدون') as display_color
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes cc ON i.color_code_id = cc.id
      ORDER BY w.name, pt.name, cc.code
    `).all();
    res.json(inventory);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', (req, res) => {
  try {
    const { warehouse_id, product_type_id, color_code_id, color_code, color_name, color_shade, color_description, quantity, unit_cost, unit_price, opening_balance } = req.body;

    let finalColorCodeId = color_code_id;

    // If new color code is provided, create it first
    if (color_code && color_name && !color_code_id) {
      const existingColor = db.prepare('SELECT id FROM color_codes WHERE code = ?').get(color_code);
      if (existingColor) {
        finalColorCodeId = existingColor.id;
      } else {
        const colorResult = db.prepare(`INSERT INTO color_codes (code, main_color, shade, active) VALUES (?, ?, ?, 1)`).run(color_code, color_name, color_shade || null);
        finalColorCodeId = colorResult.lastInsertRowid;
        logAudit('color_codes', finalColorCodeId, 'create', null, { code: color_code, main_color: color_name, shade: color_shade }, req.body.user || 'system');
      }
    }

    // Check if this product already exists in this warehouse with same color
    const existing = db.prepare(`
      SELECT id, quantity, unit_cost, unit_price FROM inventory
      WHERE warehouse_id = ? AND product_type_id = ? AND COALESCE(color_code_id, 0) = COALESCE(?, 0)
    `).get(warehouse_id, product_type_id, finalColorCodeId || null);

    if (existing) {
      // Merge: add quantity, update cost/price if provided
      const newQty = (existing.quantity || 0) + (quantity || 0);
      const newCost = unit_cost || existing.unit_cost || 0;
      const newPrice = unit_price || existing.unit_price || 0;
      db.prepare(`UPDATE inventory SET quantity = ?, unit_cost = ?, unit_price = ? WHERE id = ?`)
        .run(newQty, newCost, newPrice, existing.id);
      if (quantity > 0) {
        db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, notes, created_by) VALUES (?, 'in', ?, ?, 'manual', ?, ?)`)
          .run(existing.id, quantity, unit_cost || 0, 'إضافة مخزون - دمج تلقائي', req.body.user || 'system');
      }
      logAudit('inventory', existing.id, 'update', existing, { quantity: newQty, unit_cost: newCost, unit_price: newPrice }, req.body.user || 'system');
      res.status(200).json({ id: existing.id, merged: true, color_code_id: finalColorCodeId, ...req.body });
    } else {
      const result = db.prepare(`
        INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, color_description, quantity, unit_cost, unit_price, opening_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(warehouse_id, product_type_id, finalColorCodeId || null, color_description || null, quantity || 0, unit_cost || 0, unit_price || 0, opening_balance || 0);
      logAudit('inventory', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
      res.status(201).json({ id: result.lastInsertRowid, color_code_id: finalColorCodeId, ...req.body });
    }
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/inventory/movement', (req, res) => {
  try {
    const { inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, req.body.user || 'system');
    const updateQty = movement_type === 'in' ? quantity : -quantity;
    db.prepare(`UPDATE inventory SET quantity = quantity + ? WHERE id = ?`).run(updateQty, inventory_id);
    logAudit('inventory_movements', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/inventory/:id/movements', (req, res) => {
  try {
    const movements = db.prepare(`SELECT * FROM inventory_movements WHERE inventory_id = ? ORDER BY created_at DESC`).all(req.params.id);
    res.json(movements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - SERVICE TYPES
// ============================================

app.get('/api/service-types', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM service_types').all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/service-types', (req, res) => {
  try {
    const { name, description, overhead_rate } = req.body;
    const code = generateCode('service_types');
    const result = db.prepare(`INSERT INTO service_types (code, name, description, overhead_rate) VALUES (?, ?, ?, ?)`).run(code, name, description, overhead_rate || 0.10);
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/service-types/:id', (req, res) => {
  try {
    const { name, description, overhead_rate } = req.body;
    db.prepare(`UPDATE service_types SET name = ?, description = ?, overhead_rate = ? WHERE id = ?`).run(name, description, overhead_rate, req.params.id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/service-types/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM service_types WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - ARTISANS
// ============================================

app.get('/api/artisans', (req, res) => {
  try {
    const artisans = db.prepare(`
      SELECT a.*, GROUP_CONCAT(json_object('service_type_id', ast.service_type_id, 'service_name', st.name, 'rate', ast.rate, 'rate_unit', ast.rate_unit)) as services
      FROM artisans a LEFT JOIN artisan_services ast ON a.id = ast.artisan_id LEFT JOIN service_types st ON ast.service_type_id = st.id GROUP BY a.id
    `).all();
    artisans.forEach(a => { a.services = a.services ? JSON.parse('[' + a.services + ']') : []; });
    res.json(artisans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/artisans/qualified', (req, res) => {
  try {
    const { service_type_id } = req.query;
    const artisans = db.prepare(`
      SELECT a.*, ast.rate, ast.rate_unit, st.name as service_name FROM artisans a
      INNER JOIN artisan_services ast ON a.id = ast.artisan_id INNER JOIN service_types st ON ast.service_type_id = st.id
      WHERE ast.service_type_id = ? AND a.active = 1 ORDER BY ast.rate ASC
    `).all(service_type_id);
    res.json(artisans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get TDWAR workers only (for spinning orders)
app.get('/api/artisans/tdwar', (req, res) => {
  try {
    // Get TDWAR service type ID
    const tdwarService = db.prepare(`
      SELECT id FROM service_types
      WHERE name LIKE '%تدوير%' OR name LIKE '%TDWAR%' OR code = 'SRV_TDWAR'
      LIMIT 1
    `).get();

    if (!tdwarService) {
      return res.json([]); // No TDWAR service defined
    }

    // Get artisans assigned to TDWAR service
    const artisans = db.prepare(`
      SELECT a.id, a.code, a.name, a.phone, a.craft_type, a.account_balance,
             ast.rate, ast.rate_unit
      FROM artisans a
      INNER JOIN artisan_services ast ON a.id = ast.artisan_id
      WHERE ast.service_type_id = ? AND a.active = 1
      ORDER BY a.name
    `).all(tdwarService.id);

    res.json(artisans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/artisans', (req, res) => {
  try {
    const { name, phone, address, craft_type, daily_expense, weekly_expense, services } = req.body;
    const code = generateCode('artisans');
    const result = db.prepare(`INSERT INTO artisans (code, name, phone, address, craft_type, daily_expense, weekly_expense) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(code, name, phone, address, craft_type || null, daily_expense || null, weekly_expense || null);
    const artisanId = result.lastInsertRowid;
    if (services && services.length > 0) {
      const insertService = db.prepare(`INSERT INTO artisan_services (artisan_id, service_type_id, rate, rate_unit) VALUES (?, ?, ?, ?)`);
      services.forEach(s => insertService.run(artisanId, s.service_type_id, s.rate, s.rate_unit || 'كيلو'));
    }
    logAudit('artisans', artisanId, 'create', null, { ...req.body, code }, req.body.user || 'system');
    res.status(201).json({ id: artisanId, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/artisans/:id', (req, res) => {
  try {
    const { name, phone, address, craft_type, daily_expense, weekly_expense, services, active } = req.body;
    const artisanId = req.params.id;
    const old = db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisanId);
    db.prepare(`UPDATE artisans SET name = ?, phone = ?, address = ?, craft_type = ?, daily_expense = ?, weekly_expense = ?, active = ? WHERE id = ?`).run(name, phone, address, craft_type || null, daily_expense || null, weekly_expense || null, active !== undefined ? active : 1, artisanId);
    if (services) {
      db.prepare('DELETE FROM artisan_services WHERE artisan_id = ?').run(artisanId);
      const insertService = db.prepare(`INSERT INTO artisan_services (artisan_id, service_type_id, rate, rate_unit) VALUES (?, ?, ?, ?)`);
      services.forEach(s => insertService.run(artisanId, s.service_type_id, s.rate, s.rate_unit || 'كيلو'));
    }
    logAudit('artisans', artisanId, 'update', old, req.body, req.body.user || 'system');
    res.json({ id: artisanId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/artisans/:id', (req, res) => {
  try {
    const artisanId = req.params.id;
    const old = db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisanId);
    db.prepare('DELETE FROM artisan_services WHERE artisan_id = ?').run(artisanId);
    db.prepare('DELETE FROM artisans WHERE id = ?').run(artisanId);
    logAudit('artisans', artisanId, 'delete', old, null, req.body.user || 'system');
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - MANUFACTURING (v2.2 - Enhanced)
// ============================================

app.get('/api/manufacturing/orders', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT mo.*, st.name as service_name, st.overhead_rate, a.name as artisan_name
      FROM manufacturing_orders mo
      LEFT JOIN service_types st ON mo.service_type_id = st.id
      LEFT JOIN artisans a ON mo.artisan_id = a.id
      ORDER BY mo.date DESC
    `).all();

    // Get inputs for each order
    orders.forEach(order => {
      order.inputs = db.prepare(`
        SELECT mi.*, i.id as inv_id, pt.name as product_name, cc.code as color_code,
               COALESCE(cc.code, i.color_description, 'بدون') as display_color
        FROM manufacturing_inputs mi
        LEFT JOIN inventory i ON mi.inventory_id = i.id
        LEFT JOIN product_types pt ON i.product_type_id = pt.id
        LEFT JOIN color_codes cc ON i.color_code_id = cc.id
        WHERE mi.manufacturing_order_id = ?
      `).all(order.id);

      order.outputs = db.prepare(`
        SELECT mo.*, i.id as inv_id, pt.name as product_name, cc.code as color_code
        FROM manufacturing_outputs mo
        LEFT JOIN inventory i ON mo.output_inventory_id = i.id
        LEFT JOIN product_types pt ON i.product_type_id = pt.id
        LEFT JOIN color_codes cc ON i.color_code_id = cc.id
        WHERE mo.manufacturing_order_id = ?
      `).all(order.id);
    });

    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/manufacturing/orders', (req, res) => {
  try {
    const { order_number, date, service_type_id, artisan_id, labor_cost_per_unit, materials, notes } = req.body;

    // Validate artisan has this service
    const artisanService = db.prepare(`SELECT rate, rate_unit FROM artisan_services WHERE artisan_id = ? AND service_type_id = ?`).get(artisan_id, service_type_id);
    const serviceType = db.prepare(`SELECT overhead_rate FROM service_types WHERE id = ?`).get(service_type_id);

    // Calculate costs
    let totalMaterialCost = 0;
    materials.forEach(m => {
      const inv = db.prepare('SELECT unit_cost FROM inventory WHERE id = ?').get(m.inventory_id);
      const qty = m.quantity_used || m.quantity || 0;
      totalMaterialCost += (inv.unit_cost * qty);
    });

    const totalExpectedOutput = materials.reduce((sum, m) => sum + (m.expected_output_quantity || 0), 0);
    const laborRate = labor_cost_per_unit || (artisanService ? artisanService.rate : 0);
    const totalLaborCost = totalExpectedOutput * laborRate;
    const overheadCost = totalMaterialCost * (serviceType?.overhead_rate || 0.10);
    const totalCost = totalMaterialCost + totalLaborCost + overheadCost;

    // Create order
    const orderResult = db.prepare(`
      INSERT INTO manufacturing_orders (order_number, date, service_type_id, artisan_id, labor_cost_per_unit, total_material_cost, total_labor_cost, overhead_cost, total_cost, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'قيد_التحضير')
    `).run(order_number, date, service_type_id, artisan_id, laborRate, totalMaterialCost, totalLaborCost, overheadCost, totalCost, notes);
    const orderId = orderResult.lastInsertRowid;

    // Insert inputs with expected quantities
    const insertInput = db.prepare(`
      INSERT INTO manufacturing_inputs (manufacturing_order_id, inventory_id, quantity_used, expected_output_quantity, unit_cost, total_cost, status)
      VALUES (?, ?, ?, ?, ?, ?, 'قيد_التحضير')
    `);

    materials.forEach(m => {
      const inv = db.prepare('SELECT unit_cost FROM inventory WHERE id = ?').get(m.inventory_id);
      const qty = m.quantity_used || m.quantity || 0;
      insertInput.run(orderId, m.inventory_id, qty, m.expected_output_quantity || null, inv.unit_cost, inv.unit_cost * qty);

      // Deduct from inventory
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(qty, m.inventory_id);
      db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, 'out', ?, 'manufacturing', ?, ?)`).run(m.inventory_id, qty, orderId, req.body.user || 'system');
    });

    logAudit('manufacturing_orders', orderId, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: orderId, totalCost });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Complete a single input material
app.put('/api/manufacturing/inputs/:inputId/complete', (req, res) => {
  try {
    const { actual_output_quantity, output_inventory_id, waste_quantity } = req.body;
    const inputId = req.params.inputId;

    const input = db.prepare('SELECT * FROM manufacturing_inputs WHERE id = ?').get(inputId);
    if (!input) return res.status(404).json({ error: 'Input not found' });

    const order = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(input.manufacturing_order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // --- COLOR AUTO-RESOLUTION (same as TDWAR) ---
    const inputInv = db.prepare('SELECT color_code_id FROM inventory WHERE id = ?').get(input.inventory_id);
    const sourceColorId = inputInv?.color_code_id;
    if (!sourceColorId) {
      return res.status(400).json({ error: 'لون المادة الأولية غير محدد - لا يمكن إكمال الإنتاج' });
    }

    const clientOutput = db.prepare('SELECT product_type_id, warehouse_id, color_code_id FROM inventory WHERE id = ?').get(output_inventory_id);
    if (!clientOutput) {
      return res.status(400).json({ error: 'مخزون الإخراج غير موجود' });
    }

    let resolvedOutputId = output_inventory_id;
    if (clientOutput.color_code_id !== sourceColorId) {
      let correctInv = db.prepare('SELECT id FROM inventory WHERE warehouse_id = ? AND product_type_id = ? AND COALESCE(color_code_id, 0) = COALESCE(?, 0) LIMIT 1').get(clientOutput.warehouse_id, clientOutput.product_type_id, sourceColorId);
      if (!correctInv) {
        const newInv = db.prepare('INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, quantity, unit_cost, unit_price) VALUES (?, ?, ?, 0, 0, 0)').run(clientOutput.warehouse_id, clientOutput.product_type_id, sourceColorId);
        resolvedOutputId = newInv.lastInsertRowid;
        logAudit('inventory', resolvedOutputId, 'create', null, { auto_created: true, color_code_id: sourceColorId }, req.body.user || 'system');
      } else {
        resolvedOutputId = correctInv.id;
      }
    }
    // --- END COLOR AUTO-RESOLUTION ---

    // Calculate extraction rate
    const extractionRate = input.quantity_used > 0 ? (actual_output_quantity / input.quantity_used) * 100 : 0;
    const actualWaste = waste_quantity || (input.expected_output_quantity - actual_output_quantity);

    // Update input
    db.prepare(`
      UPDATE manufacturing_inputs
      SET actual_output_quantity = ?, waste_quantity = ?, extraction_rate = ?, status = 'مكتمل'
      WHERE id = ?
    `).run(actual_output_quantity, actualWaste, extractionRate, inputId);

    // Calculate unit cost for this output
    const unitCost = input.total_cost / actual_output_quantity;

    // Create output record
    db.prepare(`
      INSERT INTO manufacturing_outputs (manufacturing_order_id, manufacturing_input_id, output_inventory_id, quantity, unit_cost)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.manufacturing_order_id, inputId, resolvedOutputId, actual_output_quantity, unitCost);

    // Add to inventory
    db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(actual_output_quantity, resolvedOutputId);
    db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by) VALUES (?, 'in', ?, ?, 'manufacturing', ?, ?)`).run(resolvedOutputId, actual_output_quantity, unitCost, input.manufacturing_order_id, req.body.user || 'system');

    // Check if all inputs are complete
    const pendingInputs = db.prepare(`SELECT COUNT(*) as count FROM manufacturing_inputs WHERE manufacturing_order_id = ? AND status != 'مكتمل'`).get(input.manufacturing_order_id);

    if (pendingInputs.count === 0) {
      // All inputs complete - complete the order
      db.prepare(`UPDATE manufacturing_orders SET status = 'مكتمل', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(input.manufacturing_order_id);

      // Pay artisan
      db.prepare(`INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id) VALUES (?, ?, 'debit', ?, ?, 'manufacturing', ?)`).run(order.artisan_id, new Date().toISOString().split('T')[0], order.total_labor_cost, `أجر تصنيع - طلب ${order.order_number}`, input.manufacturing_order_id);
      db.prepare('UPDATE artisans SET account_balance = account_balance + ? WHERE id = ?').run(order.total_labor_cost, order.artisan_id);
    }

    logAudit('manufacturing_inputs', inputId, 'update', input, { actual_output_quantity, status: 'مكتمل' }, req.body.user || 'system');
    res.json({ message: 'Input completed', extractionRate, unitCost });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Legacy complete endpoint (for backward compatibility)
app.put('/api/manufacturing/orders/:id/complete', (req, res) => {
  try {
    const { outputs } = req.body; // Array of { input_id, actual_output_quantity, output_inventory_id, waste_quantity }
    const orderId = req.params.id;

    const order = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (outputs && outputs.length > 0) {
      outputs.forEach(out => {
        const input = db.prepare('SELECT * FROM manufacturing_inputs WHERE id = ?').get(out.input_id);
        if (!input) return;

        // --- COLOR AUTO-RESOLUTION (same as TDWAR) ---
        const inputInv = db.prepare('SELECT color_code_id FROM inventory WHERE id = ?').get(input.inventory_id);
        const sourceColorId = inputInv?.color_code_id;
        if (!sourceColorId) return; // skip — color mandatory

        const clientOutput = db.prepare('SELECT product_type_id, warehouse_id, color_code_id FROM inventory WHERE id = ?').get(out.output_inventory_id);
        let resolvedOutputId = out.output_inventory_id;
        if (clientOutput && clientOutput.color_code_id !== sourceColorId) {
          let correctInv = db.prepare('SELECT id FROM inventory WHERE warehouse_id = ? AND product_type_id = ? AND COALESCE(color_code_id, 0) = COALESCE(?, 0) LIMIT 1').get(clientOutput.warehouse_id, clientOutput.product_type_id, sourceColorId);
          if (!correctInv) {
            const newInv = db.prepare('INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, quantity, unit_cost, unit_price) VALUES (?, ?, ?, 0, 0, 0)').run(clientOutput.warehouse_id, clientOutput.product_type_id, sourceColorId);
            resolvedOutputId = newInv.lastInsertRowid;
          } else {
            resolvedOutputId = correctInv.id;
          }
        }
        // --- END COLOR AUTO-RESOLUTION ---

        const extractionRate = input.quantity_used > 0 ? (out.actual_output_quantity / input.quantity_used) * 100 : 0;
        const actualWaste = out.waste_quantity || (input.expected_output_quantity - out.actual_output_quantity);
        const unitCost = input.total_cost / out.actual_output_quantity;

        db.prepare(`UPDATE manufacturing_inputs SET actual_output_quantity = ?, waste_quantity = ?, extraction_rate = ?, status = 'مكتمل' WHERE id = ?`).run(out.actual_output_quantity, actualWaste, extractionRate, out.input_id);
        db.prepare(`INSERT INTO manufacturing_outputs (manufacturing_order_id, manufacturing_input_id, output_inventory_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)`).run(orderId, out.input_id, resolvedOutputId, out.actual_output_quantity, unitCost);
        db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(out.actual_output_quantity, resolvedOutputId);
        db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by) VALUES (?, 'in', ?, ?, 'manufacturing', ?, ?)`).run(resolvedOutputId, out.actual_output_quantity, unitCost, orderId, req.body.user || 'system');
      });
    }

    db.prepare(`UPDATE manufacturing_orders SET status = 'مكتمل', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
    db.prepare(`INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id) VALUES (?, ?, 'debit', ?, ?, 'manufacturing', ?)`).run(order.artisan_id, new Date().toISOString().split('T')[0], order.total_labor_cost, `أجر تصنيع - طلب ${order.order_number}`, orderId);
    db.prepare('UPDATE artisans SET account_balance = account_balance + ? WHERE id = ?').run(order.total_labor_cost, order.artisan_id);

    logAudit('manufacturing_orders', orderId, 'update', order, { status: 'مكتمل' }, req.body.user || 'system', 'Order completed');
    res.json({ message: 'Order completed successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// TDWAR PRODUCTION SYSTEM (v2.3)
// ============================================

// Create TDWAR order with compositions and JAAB bags
// Create TDWAR order with MULTIPLE color combinations
app.post('/api/tdwar/orders', (req, res) => {
  try {
    const {
      order_number, date, artisan_id,
      color_combinations, // Array of {bobine_inventory_id, color_code_id, number_of_compositions}
      jaab_inventory_id, number_of_bags,
      labor_cost_per_kg, notes, user,
      // Legacy single-color support
      bobine_inventory_id, color_code_id, number_of_compositions
    } = req.body;

    // Get TDWAR service type
    let tdwarService = db.prepare(`SELECT id, overhead_rate FROM service_types WHERE name LIKE '%تدوير%' OR name LIKE '%TDWAR%'`).get();
    if (!tdwarService) {
      const result = db.prepare(`INSERT INTO service_types (code, name, description, overhead_rate) VALUES ('SRV_TDWAR', 'تدوير TDWAR', 'خدمة تدوير الخيط', 0.05)`).run();
      tdwarService = { id: result.lastInsertRowid, overhead_rate: 0.05 };
    }

    // Normalize to array of color combinations
    let combinations = color_combinations || [];
    if (combinations.length === 0 && bobine_inventory_id) {
      // Legacy single-color format
      combinations = [{ bobine_inventory_id, color_code_id, number_of_compositions }];
    }

    if (combinations.length === 0) {
      return res.status(400).json({ error: 'يجب إضافة تركيبة واحدة على الأقل' });
    }

    // Validate all combinations and calculate totals
    let totalBobbins = 0;
    let totalMaterialCost = 0;
    const validatedCombinations = [];

    for (const combo of combinations) {
      const bobbins = combo.number_of_compositions * 4;
      const bobineStock = db.prepare('SELECT quantity, unit_cost, color_code_id FROM inventory WHERE id = ?').get(combo.bobine_inventory_id);

      if (!bobineStock || bobineStock.quantity < bobbins) {
        return res.status(400).json({
          error: `المخزون غير كافي للون. المطلوب: ${bobbins} بوبين، المتوفر: ${bobineStock?.quantity || 0}`
        });
      }

      totalBobbins += bobbins;
      totalMaterialCost += bobineStock.unit_cost * bobbins;
      validatedCombinations.push({
        ...combo,
        bobbins,
        unit_cost: bobineStock.unit_cost,
        total_cost: bobineStock.unit_cost * bobbins,
        color_code_id: combo.color_code_id || bobineStock.color_code_id
      });
    }

    // JAAB is optional (number_of_bags can be 0)
    const bagsCount = number_of_bags || 0;
    let jaabStock = null;

    if (bagsCount > 0 && jaab_inventory_id) {
      jaabStock = db.prepare('SELECT quantity, unit_cost FROM inventory WHERE id = ?').get(jaab_inventory_id);
      if (!jaabStock || jaabStock.quantity < bagsCount) {
        return res.status(400).json({
          error: `المخزون غير كافي. المطلوب: ${bagsCount} خنشة، المتوفر: ${jaabStock?.quantity || 0}`
        });
      }
    }

    // Create order
    const orderResult = db.prepare(`
      INSERT INTO manufacturing_orders (
        order_number, date, service_type_id, artisan_id, labor_cost_per_unit,
        number_of_compositions, bobbins_used, number_of_bags,
        total_material_cost, total_labor_cost, overhead_cost, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'قيد_الإنتاج', ?)
    `).run(
      order_number, date, tdwarService.id, artisan_id, labor_cost_per_kg || 6,
      combinations.reduce((sum, c) => sum + c.number_of_compositions, 0),
      totalBobbins, bagsCount,
      totalMaterialCost, totalMaterialCost * tdwarService.overhead_rate, notes
    );
    const orderId = orderResult.lastInsertRowid;

    // Process each color combination
    for (const combo of validatedCombinations) {
      // Deduct BOBINE from inventory
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(combo.bobbins, combo.bobine_inventory_id);
      db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, 'out', ?, 'tdwar', ?, ?, ?)`).run(
        combo.bobine_inventory_id, combo.bobbins, orderId, `${combo.number_of_compositions} تركيبة`, user || 'system'
      );

      // Insert as manufacturing input
      db.prepare(`
        INSERT INTO manufacturing_inputs (manufacturing_order_id, inventory_id, quantity_used, unit_cost, total_cost, status)
        VALUES (?, ?, ?, ?, ?, 'قيد_الإنتاج')
      `).run(orderId, combo.bobine_inventory_id, combo.bobbins, combo.unit_cost, combo.total_cost);

      // Track color combination separately
      db.prepare(`
        INSERT INTO tdwar_color_combinations (manufacturing_order_id, bobine_inventory_id, color_code_id, number_of_compositions, bobbins_used)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, combo.bobine_inventory_id, combo.color_code_id, combo.number_of_compositions, combo.bobbins);
    }

    // Process JAAB if bags > 0
    if (bagsCount > 0 && jaab_inventory_id && jaabStock) {
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(bagsCount, jaab_inventory_id);
      db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, 'out', ?, 'tdwar', ?, ?, ?)`).run(
        jaab_inventory_id, bagsCount, orderId, `${bagsCount} خنشة للتدوير`, user || 'system'
      );

      // Create production bags - status = 'مفتوحة' (open until closed)
      const insertBag = db.prepare(`
        INSERT INTO production_bags (manufacturing_order_id, artisan_id, jaab_inventory_id, date_given, status, expected_output_kg)
        VALUES (?, ?, ?, ?, 'مفتوحة', 26)
      `);
      for (let i = 0; i < bagsCount; i++) {
        insertBag.run(orderId, artisan_id, jaab_inventory_id, date);
      }
    }

    logAudit('manufacturing_orders', orderId, 'create', null, req.body, user || 'system');
    res.status(201).json({
      id: orderId,
      order_number,
      color_combinations_count: validatedCombinations.length,
      bobbins_deducted: totalBobbins,
      bags_created: bagsCount,
      total_material_cost: totalMaterialCost
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Record production entry (daily production)
// Labor cost = actual production × price (NOT expected)
app.post('/api/tdwar/production', (req, res) => {
  try {
    const {
      manufacturing_order_id, production_bag_id,
      quantity_kg, output_inventory_id, color_code_id, date, notes, user
    } = req.body;

    // Get order details
    const order = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(manufacturing_order_id);
    if (!order) return res.status(404).json({ error: 'أمر التصنيع غير موجود' });
    if (order.status === 'مكتمل') return res.status(400).json({ error: 'الأمر مكتمل ولا يمكن إضافة إنتاج' });

    // Get bag details if provided
    let bag = null;
    if (production_bag_id) {
      bag = db.prepare('SELECT * FROM production_bags WHERE id = ?').get(production_bag_id);
      if (!bag) return res.status(404).json({ error: 'الخنشة غير موجودة' });
    }

    // Get color from order's BOBINE input
    const bobineInput = db.prepare(`
      SELECT mi.*, i.color_code_id FROM manufacturing_inputs mi
      JOIN inventory i ON mi.inventory_id = i.id
      WHERE mi.manufacturing_order_id = ? AND i.product_type_id IN (
        SELECT id FROM product_types WHERE UPPER(name) LIKE '%BOBINE%' OR name LIKE '%بوبين%'
      ) LIMIT 1
    `).get(manufacturing_order_id);
    const productColorId = color_code_id || bag?.color_code_id || bobineInput?.color_code_id || null;

    // Auto-find or create SABRA inventory with same color
    let finalOutputInventoryId = output_inventory_id;

    if (!finalOutputInventoryId && productColorId) {
      // Find existing SABRA with same color
      let sabraInventory = db.prepare(`
        SELECT i.* FROM inventory i
        JOIN product_types pt ON i.product_type_id = pt.id
        WHERE (UPPER(pt.name) LIKE '%SABRA%' OR pt.name LIKE '%صبرة%' OR pt.name LIKE '%سبرة%')
        AND i.color_code_id = ?
        LIMIT 1
      `).get(productColorId);

      if (!sabraInventory) {
        // Create new SABRA inventory with this color
        const sabraProductType = db.prepare(`
          SELECT id FROM product_types
          WHERE UPPER(name) LIKE '%SABRA%' OR name LIKE '%صبرة%' OR name LIKE '%سبرة%'
          LIMIT 1
        `).get();

        const defaultWarehouse = db.prepare('SELECT id FROM warehouses LIMIT 1').get();

        if (sabraProductType && defaultWarehouse) {
          const newInv = db.prepare(`
            INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, quantity, unit_cost, unit_price)
            VALUES (?, ?, ?, 0, 0, 0)
          `).run(defaultWarehouse.id, sabraProductType.id, productColorId);
          finalOutputInventoryId = newInv.lastInsertRowid;
          logAudit('inventory', finalOutputInventoryId, 'create', null, { auto_created: true, color_code_id: productColorId }, user || 'system');
        }
      } else {
        finalOutputInventoryId = sabraInventory.id;
      }
    }

    if (!finalOutputInventoryId) {
      return res.status(400).json({ error: 'يجب تحديد مخزون الإخراج أو كود اللون' });
    }

    const productionDate = date || new Date().toISOString().split('T')[0];
    const unitPrice = order.labor_cost_per_unit || 6;
    // Labor cost based on ACTUAL production
    const artisanAmount = quantity_kg * unitPrice;

    // Create production entry
    const entryResult = db.prepare(`
      INSERT INTO production_entries (
        manufacturing_order_id, production_bag_id, artisan_id, date,
        quantity_kg, output_inventory_id, color_code_id, unit_price, artisan_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      manufacturing_order_id, production_bag_id || null, order.artisan_id, productionDate,
      quantity_kg, finalOutputInventoryId, productColorId, unitPrice, artisanAmount, notes
    );

    // Add to SABRA inventory (output)
    db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(quantity_kg, finalOutputInventoryId);

    // Get unit cost from materials
    const materialCost = db.prepare('SELECT SUM(total_cost) as total FROM manufacturing_inputs WHERE manufacturing_order_id = ?').get(manufacturing_order_id);
    const totalProducedBefore = db.prepare('SELECT COALESCE(SUM(quantity_kg), 0) as total FROM production_entries WHERE manufacturing_order_id = ? AND id != ?').get(manufacturing_order_id, entryResult.lastInsertRowid);
    const newTotalProduced = (totalProducedBefore?.total || 0) + quantity_kg;
    const outputUnitCost = newTotalProduced > 0 ? (materialCost?.total || 0) / newTotalProduced : 0;

    db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by) VALUES (?, 'in', ?, ?, 'tdwar_production', ?, ?, ?)`).run(
      finalOutputInventoryId, quantity_kg, outputUnitCost, manufacturing_order_id, `إنتاج ${productionDate}`, user || 'system'
    );

    // Update production bag if linked
    if (production_bag_id) {
      db.prepare(`UPDATE production_bags SET total_produced_kg = total_produced_kg + ? WHERE id = ?`).run(quantity_kg, production_bag_id);
    }

    // Update order totals - labor cost from ACTUAL production
    const newTotalLabor = newTotalProduced * unitPrice;
    db.prepare(`
      UPDATE manufacturing_orders
      SET total_produced_kg = ?, total_labor_cost = ?, avg_kg_per_bag = ?
      WHERE id = ?
    `).run(newTotalProduced, newTotalLabor, order.number_of_bags > 0 ? newTotalProduced / order.number_of_bags : 0, manufacturing_order_id);

    // Add to artisan earnings (based on actual production)
    db.prepare(`INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id) VALUES (?, ?, 'debit', ?, ?, 'production', ?)`).run(
      order.artisan_id, productionDate, artisanAmount, `إنتاج ${quantity_kg} كلغ`, entryResult.lastInsertRowid
    );
    db.prepare('UPDATE artisans SET account_balance = account_balance + ? WHERE id = ?').run(artisanAmount, order.artisan_id);

    logAudit('production_entries', entryResult.lastInsertRowid, 'create', null, req.body, user || 'system');
    res.status(201).json({
      id: entryResult.lastInsertRowid,
      quantity_kg,
      artisan_amount: artisanAmount,
      total_produced: newTotalProduced,
      output_inventory_id: finalOutputInventoryId
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DISABLED: Manual bag closing is NOT allowed
// Khansha closes ONLY when:
// 1. A new khansha is delivered to the same artisan (via /api/tdwar/bags/deliver)
// 2. Order is completed (via /api/tdwar/orders/:id/complete)
app.put('/api/tdwar/bags/:id/complete', (req, res) => {
  // RULE: Khansha cannot be closed manually
  // It closes automatically only when next bag is delivered
  return res.status(400).json({
    error: 'لا يمكن إغلاق الخنشة يدوياً. الخنشة تُغلق تلقائياً عند تسليم خنشة جديدة للصانع'
  });
});

// Deliver new khansha (automatically closes previous open one)
app.post('/api/tdwar/bags/deliver', (req, res) => {
  try {
    const { manufacturing_order_id, artisan_id, jaab_inventory_id, date, user } = req.body;

    const order = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(manufacturing_order_id);
    if (!order) return res.status(404).json({ error: 'أمر التصنيع غير موجود' });

    // Find any open khansha for this artisan in this order
    const openBag = db.prepare(`
      SELECT * FROM production_bags
      WHERE manufacturing_order_id = ? AND artisan_id = ? AND status = 'مفتوحة'
      ORDER BY date_given DESC LIMIT 1
    `).get(manufacturing_order_id, artisan_id);

    // Close the previous open bag if exists
    if (openBag) {
      const expectedOutput = openBag.expected_output_kg || 26;
      const actualOutput = openBag.total_produced_kg || 0;
      const wasteKg = Math.max(0, expectedOutput - actualOutput);

      let yieldClass = 'OK';
      if (actualOutput < 23) yieldClass = 'هدر';
      else if (actualOutput < 26) yieldClass = 'ضعيف';

      db.prepare(`
        UPDATE production_bags
        SET status = 'مغلقة', date_returned = ?, waste_kg = ?, yield_classification = ?, closed_by_next_bag = 1
        WHERE id = ?
      `).run(date, wasteKg, yieldClass, openBag.id);
    }

    // Deduct JAAB from inventory if provided
    if (jaab_inventory_id) {
      const jaabStock = db.prepare('SELECT quantity FROM inventory WHERE id = ?').get(jaab_inventory_id);
      if (!jaabStock || jaabStock.quantity < 1) {
        return res.status(400).json({ error: 'لا يوجد خناشي في المخزون' });
      }
      db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?').run(jaab_inventory_id);
      db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, 'out', 1, 'tdwar_bag', ?, 'تسليم خنشة جديدة', ?)`).run(
        jaab_inventory_id, manufacturing_order_id, user || 'system'
      );
    }

    // Create new bag
    const result = db.prepare(`
      INSERT INTO production_bags (manufacturing_order_id, artisan_id, jaab_inventory_id, date_given, status, expected_output_kg)
      VALUES (?, ?, ?, ?, 'مفتوحة', 26)
    `).run(manufacturing_order_id, artisan_id, jaab_inventory_id, date);

    // Update order bag count
    db.prepare('UPDATE manufacturing_orders SET number_of_bags = number_of_bags + 1 WHERE id = ?').run(manufacturing_order_id);

    res.status(201).json({
      id: result.lastInsertRowid,
      previous_bag_closed: openBag ? openBag.id : null,
      message: openBag ? 'تم إغلاق الخنشة السابقة وفتح خنشة جديدة' : 'تم فتح خنشة جديدة'
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Complete TDWAR order - auto-calculate cost from materials + labor + overhead
// Also evaluates: COMBINATION yield (9kg per combo expected)
app.put('/api/tdwar/orders/:id/complete', (req, res) => {
  try {
    const orderId = req.params.id;
    const { user } = req.body;

    const order = db.prepare('SELECT mo.*, st.overhead_rate FROM manufacturing_orders mo LEFT JOIN service_types st ON mo.service_type_id = st.id WHERE mo.id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'أمر التصنيع غير موجود' });

    const closeDate = new Date().toISOString().split('T')[0];

    // Close all open bags with waste calculation
    const openBags = db.prepare(`SELECT * FROM production_bags WHERE manufacturing_order_id = ? AND status = 'مفتوحة'`).all(orderId);
    openBags.forEach(bag => {
      const expectedOutput = bag.expected_output_kg || 26;
      const actualOutput = bag.total_produced_kg || 0;
      const wasteKg = Math.max(0, expectedOutput - actualOutput);

      let yieldClass = 'OK';
      if (actualOutput < 23) yieldClass = 'هدر';
      else if (actualOutput < 26) yieldClass = 'ضعيف';

      db.prepare(`UPDATE production_bags SET status = 'مغلقة', date_returned = ?, waste_kg = ?, yield_classification = ? WHERE id = ?`).run(
        closeDate, wasteKg, yieldClass, bag.id
      );
    });

    // Calculate final metrics
    const closedBags = db.prepare('SELECT * FROM production_bags WHERE manufacturing_order_id = ?').all(orderId);
    const avgKgPerBag = closedBags.length > 0 ? order.total_produced_kg / closedBags.length : 0;

    // ========================================
    // COMBINATION EVALUATION (9kg per combo)
    // ========================================
    const EXPECTED_KG_PER_COMBINATION = 9;
    const totalCombinations = order.number_of_compositions || 0;
    const expectedTotalFromCombos = totalCombinations * EXPECTED_KG_PER_COMBINATION;
    const actualTotalProduced = order.total_produced_kg || 0;
    const combinationDeficit = Math.max(0, expectedTotalFromCombos - actualTotalProduced);

    let combinationYield = 'OK';
    let combinationNote = null;
    if (totalCombinations > 0) {
      const avgKgPerCombo = actualTotalProduced / totalCombinations;
      if (avgKgPerCombo < 9) {
        combinationYield = 'نقص';
        combinationNote = `نقص في الإنتاج: ${combinationDeficit.toFixed(2)} كلغ (${avgKgPerCombo.toFixed(2)} كلغ/تركيبة بدل 9 كلغ)`;
      }
    }

    // ========================================
    // AUTO-CALCULATE PRODUCTION COST
    // Cost = Materials + Labor + Overhead
    // Any deficit increases unit cost automatically
    // ========================================

    // 1. Material cost (from consumed bobbins + JAAB)
    const materialCost = order.total_material_cost || 0;

    // 2. Labor cost (actual production × rate per kg)
    const laborCost = order.total_labor_cost || 0;

    // 3. Overhead (from service type rate)
    const overheadRate = order.overhead_rate || 0.05;
    const overheadCost = materialCost * overheadRate;

    // Total production cost
    const totalCost = materialCost + laborCost + overheadCost;

    // Unit cost (per kg produced) - CRITICAL: reflects actual yield
    // If production is low, unit cost is HIGH
    const unitCost = actualTotalProduced > 0 ? totalCost / actualTotalProduced : 0;

    db.prepare(`
      UPDATE manufacturing_orders
      SET status = 'مكتمل', completed_at = ?, avg_kg_per_bag = ?,
          overhead_cost = ?, total_cost = ?,
          notes = COALESCE(notes, '') || ?
      WHERE id = ?
    `).run(closeDate, avgKgPerBag, overheadCost, totalCost,
           combinationNote ? '\n[تقييم التركيبات] ' + combinationNote : '', orderId);

    // Update inventory unit costs based on ACTUAL yield
    const productions = db.prepare('SELECT DISTINCT output_inventory_id FROM production_entries WHERE manufacturing_order_id = ?').all(orderId);
    productions.forEach(p => {
      db.prepare('UPDATE inventory SET unit_cost = ? WHERE id = ?').run(unitCost, p.output_inventory_id);
    });

    logAudit('manufacturing_orders', orderId, 'update', order, {
      status: 'مكتمل',
      total_cost: totalCost,
      combination_yield: combinationYield,
      combination_deficit: combinationDeficit
    }, user || 'system');

    res.json({
      message: 'تم إغلاق أمر التصنيع',
      total_produced_kg: actualTotalProduced,
      number_of_bags: closedBags.length,
      avg_kg_per_bag: avgKgPerBag.toFixed(2),
      combination_evaluation: {
        total_combinations: totalCombinations,
        expected_total_kg: expectedTotalFromCombos,
        actual_total_kg: actualTotalProduced,
        avg_kg_per_combo: totalCombinations > 0 ? (actualTotalProduced / totalCombinations).toFixed(2) : 0,
        yield_status: combinationYield,
        deficit_kg: combinationDeficit.toFixed(2),
        note: combinationNote
      },
      cost_breakdown: {
        material_cost: materialCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        total_cost: totalCost,
        unit_cost_per_kg: unitCost.toFixed(2)
      }
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Get production bags for an order
app.get('/api/tdwar/orders/:id/bags', (req, res) => {
  try {
    const bags = db.prepare(`
      SELECT pb.*, a.name as artisan_name, cc.code as color_code
      FROM production_bags pb
      LEFT JOIN artisans a ON pb.artisan_id = a.id
      LEFT JOIN color_codes cc ON pb.color_code_id = cc.id
      WHERE pb.manufacturing_order_id = ?
      ORDER BY pb.date_given
    `).all(req.params.id);

    res.json(bags);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get color combinations for an order
app.get('/api/tdwar/orders/:id/combinations', (req, res) => {
  try {
    const combinations = db.prepare(`
      SELECT
        tcc.*,
        i.product_type_id,
        pt.name as product_name,
        cc.code as color_code,
        cc.name_ar as color_name
      FROM tdwar_color_combinations tcc
      LEFT JOIN inventory i ON tcc.bobine_inventory_id = i.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes cc ON tcc.color_code_id = cc.id
      WHERE tcc.manufacturing_order_id = ?
      ORDER BY tcc.id
    `).all(req.params.id);

    res.json(combinations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get production entries for an order
app.get('/api/tdwar/orders/:id/production', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT pe.*, a.name as artisan_name, pb.id as bag_number
      FROM production_entries pe
      LEFT JOIN artisans a ON pe.artisan_id = a.id
      LEFT JOIN production_bags pb ON pe.production_bag_id = pb.id
      WHERE pe.manufacturing_order_id = ?
      ORDER BY pe.date DESC
    `).all(req.params.id);

    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// ARTISAN EXPENSES & ADVANCES (v2.4)
// ============================================

// Get artisan expenses/advances
app.get('/api/artisans/:id/expenses', (req, res) => {
  try {
    const artisanId = req.params.id;
    const { from_date, to_date } = req.query;

    let dateFilter = '';
    const params = [artisanId];

    if (from_date && to_date) {
      dateFilter = 'AND date BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    const expenses = db.prepare(`
      SELECT * FROM artisan_accounts
      WHERE artisan_id = ? AND type = 'credit' ${dateFilter}
      ORDER BY date DESC
    `).all(...params);

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_paid
      FROM artisan_accounts
      WHERE artisan_id = ? ${dateFilter}
    `).get(...params);

    res.json({
      expenses,
      totals: {
        total_earned: totals.total_earned,
        total_paid: totals.total_paid,
        balance: totals.total_earned - totals.total_paid
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add artisan expense/advance/payment
app.post('/api/artisans/:id/expenses', (req, res) => {
  try {
    const artisanId = req.params.id;
    const { date, amount, description, expense_type, user } = req.body;

    // expense_type: 'تسبيق' (advance), 'مصروف' (expense), 'دفعة' (payment)
    const artisan = db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisanId);
    if (!artisan) return res.status(404).json({ error: 'الصانع غير موجود' });

    const expenseDate = date || new Date().toISOString().split('T')[0];
    const expType = expense_type || 'دفعة';

    // Add to artisan accounts (credit = payment/expense to artisan)
    const result = db.prepare(`
      INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id)
      VALUES (?, ?, 'credit', ?, ?, 'expense', NULL)
    `).run(artisanId, expenseDate, amount, `${expType}: ${description}`);

    // Deduct from artisan balance
    db.prepare('UPDATE artisans SET account_balance = account_balance - ? WHERE id = ?').run(amount, artisanId);

    // Create treasury entry (cash out)
    addTreasuryEntry(
      expenseDate,
      'صادر',
      `${expType} للصانع ${artisan.name}: ${description}`,
      amount,
      'الصندوق',
      'artisan_expense',
      result.lastInsertRowid,
      user || 'system'
    );

    logAudit('artisan_accounts', result.lastInsertRowid, 'create', null, req.body, user || 'system');

    res.status(201).json({
      id: result.lastInsertRowid,
      artisan_name: artisan.name,
      amount,
      new_balance: artisan.account_balance - amount
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// ARTISAN DASHBOARD & ANALYTICS (v2.5 - Fixed)
// ============================================

// Artisan performance dashboard
app.get('/api/artisans/:id/dashboard', (req, res) => {
  try {
    const artisanId = req.params.id;
    const { period } = req.query; // daily, weekly, monthly

    const artisan = db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisanId);
    if (!artisan) return res.status(404).json({ error: 'الصانع غير موجود' });

    // Build date filters for different tables
    let prodDateFilter = '';
    let bagDateFilter = '';
    let orderDateFilter = '';
    let accountDateFilter = '';

    if (period === 'daily') {
      prodDateFilter = `AND date(date) = date('now')`;
      bagDateFilter = `AND date(date_returned) = date('now')`;
      orderDateFilter = `AND date(date) = date('now')`;
      accountDateFilter = `AND date(date) = date('now')`;
    } else if (period === 'weekly') {
      prodDateFilter = `AND date(date) >= date('now', '-7 days')`;
      bagDateFilter = `AND date(date_returned) >= date('now', '-7 days')`;
      orderDateFilter = `AND date(date) >= date('now', '-7 days')`;
      accountDateFilter = `AND date(date) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      prodDateFilter = `AND date(date) >= date('now', '-30 days')`;
      bagDateFilter = `AND date(date_returned) >= date('now', '-30 days')`;
      orderDateFilter = `AND date(date) >= date('now', '-30 days')`;
      accountDateFilter = `AND date(date) >= date('now', '-30 days')`;
    }

    // KPIs - Production (confirmed output only)
    const production = db.prepare(`
      SELECT
        COALESCE(SUM(quantity_kg), 0) as total_kg,
        COALESCE(SUM(artisan_amount), 0) as total_earned,
        COUNT(DISTINCT date) as working_days,
        COUNT(id) as entries_count
      FROM production_entries
      WHERE artisan_id = ? ${prodDateFilter}
    `).get(artisanId);

    // Bags - ONLY closed bags (waste calculated only for closed)
    const bags = db.prepare(`
      SELECT
        COUNT(*) as total_bags,
        COALESCE(AVG(total_produced_kg), 0) as avg_per_bag,
        COALESCE(MAX(total_produced_kg), 0) as best_bag,
        COALESCE(MIN(CASE WHEN total_produced_kg > 0 THEN total_produced_kg END), 0) as worst_bag,
        COALESCE(SUM(waste_kg), 0) as total_waste_kg,
        SUM(CASE WHEN yield_classification = 'هدر' THEN 1 ELSE 0 END) as waste_count,
        SUM(CASE WHEN yield_classification = 'ضعيف' THEN 1 ELSE 0 END) as weak_count,
        SUM(CASE WHEN yield_classification = 'OK' THEN 1 ELSE 0 END) as ok_count
      FROM production_bags
      WHERE artisan_id = ? AND status = 'مغلقة' ${bagDateFilter}
    `).get(artisanId);

    // Open bags count (no waste/ratio shown for these)
    const openBags = db.prepare(`
      SELECT COUNT(*) as count
      FROM production_bags
      WHERE artisan_id = ? AND status = 'مفتوحة'
    `).get(artisanId);

    const colors = db.prepare(`
      SELECT COUNT(DISTINCT color_code_id) as count
      FROM production_entries
      WHERE artisan_id = ? ${prodDateFilter}
    `).get(artisanId);

    const compositions = db.prepare(`
      SELECT COALESCE(SUM(number_of_compositions), 0) as count
      FROM manufacturing_orders
      WHERE artisan_id = ? ${orderDateFilter}
    `).get(artisanId);

    // Payments
    const payments = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_paid
      FROM artisan_accounts
      WHERE artisan_id = ? ${accountDateFilter}
    `).get(artisanId);

    // Calculate waste percentage (ONLY from closed bags)
    const closedBagsCount = bags.total_bags || 0;
    const wastePercent = closedBagsCount > 0 ? ((bags.waste_count || 0) / closedBagsCount * 100).toFixed(1) : null;

    // Average per day
    const avgPerDay = production.working_days > 0 ? (production.total_kg / production.working_days).toFixed(2) : 0;

    res.json({
      artisan: {
        id: artisan.id,
        name: artisan.name,
        craft_type: artisan.craft_type,
        balance: artisan.account_balance
      },
      kpis: {
        kg_total: production.total_kg,
        kg_today: period === 'daily' ? production.total_kg : null,
        kg_week: period === 'weekly' ? production.total_kg : null,
        working_days: production.working_days || 0,
        avg_kg_per_day: parseFloat(avgPerDay),
        avg_kg_per_bag: closedBagsCount > 0 ? parseFloat(bags.avg_per_bag?.toFixed(2) || 0) : null,
        closed_bags: closedBagsCount,
        open_bags: openBags.count || 0,
        // Waste only for closed bags
        total_waste_kg: bags.total_waste_kg || 0,
        total_earned: production.total_earned,
        total_paid: payments.total_paid,
        balance: artisan.account_balance
      },
      yield_breakdown: {
        ok: bags.ok_count || 0,
        weak: bags.weak_count || 0,
        waste: bags.waste_count || 0,
        note: openBags.count > 0 ? `${openBags.count} خنشة مفتوحة (لا يحسب هدرها بعد)` : null
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Artisan comparison view - TDWAR workers only, waste from closed bags only
app.get('/api/artisans/comparison', (req, res) => {
  try {
    const { period } = req.query;

    // Build date filter
    let prodDateFilter = '';
    let bagDateFilter = '';
    if (period === 'daily') {
      prodDateFilter = `AND date(pe.date) = date('now')`;
      bagDateFilter = `AND date(pb.date_returned) = date('now')`;
    } else if (period === 'weekly') {
      prodDateFilter = `AND date(pe.date) >= date('now', '-7 days')`;
      bagDateFilter = `AND date(pb.date_returned) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      prodDateFilter = `AND date(pe.date) >= date('now', '-30 days')`;
      bagDateFilter = `AND date(pb.date_returned) >= date('now', '-30 days')`;
    }

    // Get TDWAR service ID
    const tdwarService = db.prepare(`
      SELECT id FROM service_types
      WHERE name LIKE '%تدوير%' OR name LIKE '%TDWAR%' OR code = 'SRV_TDWAR'
      LIMIT 1
    `).get();

    // Only compare TDWAR workers (those assigned to TDWAR service)
    let artisanFilter = 'a.active = 1';
    if (tdwarService) {
      artisanFilter = `a.active = 1 AND EXISTS (
        SELECT 1 FROM artisan_services WHERE artisan_id = a.id AND service_type_id = ${tdwarService.id}
      )`;
    }

    const comparison = db.prepare(`
      SELECT
        a.id, a.name, a.craft_type,
        COALESCE((
          SELECT SUM(quantity_kg) FROM production_entries pe
          WHERE pe.artisan_id = a.id ${prodDateFilter}
        ), 0) as total_kg,
        COALESCE((
          SELECT COUNT(DISTINCT date) FROM production_entries pe
          WHERE pe.artisan_id = a.id ${prodDateFilter}
        ), 0) as working_days,
        -- Closed bags only for waste calculation
        (SELECT COUNT(*) FROM production_bags pb
         WHERE pb.artisan_id = a.id AND pb.status = 'مغلقة' ${bagDateFilter}) as closed_bags,
        (SELECT COUNT(*) FROM production_bags pb
         WHERE pb.artisan_id = a.id AND pb.status = 'مفتوحة') as open_bags,
        (SELECT ROUND(AVG(total_produced_kg), 2) FROM production_bags pb
         WHERE pb.artisan_id = a.id AND pb.status = 'مغلقة' AND pb.total_produced_kg > 0 ${bagDateFilter}) as avg_per_bag,
        (SELECT ROUND(SUM(CASE WHEN yield_classification = 'هدر' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1)
         FROM production_bags pb WHERE pb.artisan_id = a.id AND pb.status = 'مغلقة' ${bagDateFilter}) as waste_percent
      FROM artisans a
      WHERE ${artisanFilter}
      ORDER BY total_kg DESC
    `).all();

    // Calculate avg_per_day
    comparison.forEach(c => {
      c.avg_per_day = c.working_days > 0 ? (c.total_kg / c.working_days).toFixed(2) : 0;
    });

    res.json(comparison);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Daily production summary
app.get('/api/tdwar/daily-summary', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const summary = db.prepare(`
      SELECT
        a.id as artisan_id, a.name as artisan_name,
        SUM(pe.quantity_kg) as total_kg,
        SUM(pe.artisan_amount) as total_earned,
        COUNT(pe.id) as entries_count
      FROM production_entries pe
      JOIN artisans a ON pe.artisan_id = a.id
      WHERE date(pe.date) = ?
      GROUP BY a.id
      ORDER BY total_kg DESC
    `).all(targetDate);

    const totals = db.prepare(`
      SELECT
        SUM(quantity_kg) as total_kg,
        SUM(artisan_amount) as total_cost,
        COUNT(DISTINCT artisan_id) as artisans_count
      FROM production_entries
      WHERE date(date) = ?
    `).get(targetDate);

    res.json({
      date: targetDate,
      artisans: summary,
      totals: {
        total_kg: totals?.total_kg || 0,
        total_cost: totals?.total_cost || 0,
        artisans_count: totals?.artisans_count || 0
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - POS & SALES
// ============================================

app.get('/api/sales', (req, res) => {
  try {
    const { from_date, to_date, client_id, period } = req.query;

    let dateFilter = '';
    const params = [];

    if (period === 'daily') {
      dateFilter = `AND date(s.date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(s.date) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(s.date) >= date('now', '-30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND s.date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (client_id) {
      dateFilter += ` AND s.client_id = ?`;
      params.push(client_id);
    }

    const sales = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE 1=1 ${dateFilter}
      ORDER BY s.date DESC
    `).all(...params);

    // Get items and payments for each sale
    sales.forEach(sale => {
      sale.items = db.prepare(`
        SELECT si.*, i.unit_cost
        FROM sales_items si
        LEFT JOIN inventory i ON si.inventory_id = i.id
        WHERE si.sale_id = ?
      `).all(sale.id);

      sale.payments = db.prepare(`SELECT * FROM sales_payments WHERE sale_id = ?`).all(sale.id);

      // Calculate totals
      sale.total_paid = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.remaining = sale.final_amount - sale.total_paid;

      // Calculate cost and profit
      sale.total_cost = sale.items.reduce((sum, item) => sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.quantity || 0)), 0);
      sale.profit = sale.final_amount - sale.total_cost;
    });

    // Calculate payment breakdown for each sale
    sales.forEach(sale => {
      sale.cash_paid = sale.payments.filter(p => p.payment_type === 'نقدي').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.check_paid = sale.payments.filter(p => p.payment_type === 'شيك').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.transfer_paid = sale.payments.filter(p => p.payment_type === 'تحويل').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.credit_amount = sale.payments.filter(p => p.payment_type === 'آجل').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      // Build payment summary string
      const paymentParts = [];
      if (sale.cash_paid > 0) paymentParts.push(`نقدي: ${sale.cash_paid}`);
      if (sale.check_paid > 0) paymentParts.push(`شيك: ${sale.check_paid}`);
      if (sale.transfer_paid > 0) paymentParts.push(`تحويل: ${sale.transfer_paid}`);
      if (sale.credit_amount > 0) paymentParts.push(`آجل: ${sale.credit_amount}`);
      sale.payment_summary = paymentParts.length > 0 ? paymentParts.join(' | ') : 'لم يدفع';
    });

    // Calculate KPIs with payment type breakdown
    const kpis = {
      total_sales: sales.reduce((sum, s) => sum + parseFloat(s.final_amount || 0), 0),
      total_paid: sales.reduce((sum, s) => sum + parseFloat(s.total_paid || 0), 0),
      total_remaining: sales.reduce((sum, s) => sum + parseFloat(s.remaining || 0), 0),
      total_profit: sales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0),
      total_cost: sales.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0),
      count: sales.length,
      // Payment breakdown KPIs
      total_cash: sales.reduce((sum, s) => sum + parseFloat(s.cash_paid || 0), 0),
      total_checks: sales.reduce((sum, s) => sum + parseFloat(s.check_paid || 0), 0),
      total_transfers: sales.reduce((sum, s) => sum + parseFloat(s.transfer_paid || 0), 0),
      total_credit: sales.reduce((sum, s) => sum + parseFloat(s.credit_amount || 0), 0)
    };

    res.json({ sales, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pos/sale', (req, res) => {
  try {
    const { invoice_number, date, client_id, client_name, client_phone, items, payments, discount_percent, discount_amount, notes, user } = req.body;
    const hasCredit = payments.some(p => p.payment_type === 'آجل');
    if (hasCredit && !client_phone) return res.status(400).json({ error: 'رقم الهاتف إجباري للبيع بالدين' });
    if (user !== 'admin' && discount_percent > 5) return res.status(400).json({ error: 'الخصم الأقصى للمستخدم العادي هو 5%' });
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const final_amount = subtotal - (discount_amount || 0);
    const saleResult = db.prepare(`INSERT INTO sales (invoice_number, date, client_id, client_name, client_phone, subtotal, discount_percent, discount_amount, final_amount, notes, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`).run(invoice_number, date, client_id, client_name, client_phone, subtotal, discount_percent || 0, discount_amount || 0, final_amount, notes, user || 'system');
    const saleId = saleResult.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO sales_items (sale_id, inventory_id, product_name, color_code_id, quantity, unit_price, total_price, is_special_order, special_order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    items.forEach(item => {
      insertItem.run(saleId, item.inventory_id, item.product_name, item.color_code_id, item.quantity, item.unit_price, item.total_price, item.is_special_order || 0, item.special_order_id || null);
      if (!item.is_special_order && item.inventory_id) {
        db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.inventory_id);
        db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, 'out', ?, 'sale', ?, ?)`).run(item.inventory_id, item.quantity, saleId, user || 'system');
      }
    });
    const insertPayment = db.prepare(`INSERT INTO sales_payments (sale_id, payment_type, amount, check_number, check_date, check_due_date, bank) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    // Calculate debt automatically
    const totalPaid = payments.filter(p => p.payment_type !== 'آجل').reduce((sum, p) => sum + (p.amount || 0), 0);
    const debtAmount = final_amount - totalPaid;

    payments.forEach(p => {
      insertPayment.run(saleId, p.payment_type, p.amount, p.check_number || null, p.check_date || null, p.check_due_date || null, p.bank || null);

      // Cash payment -> Treasury (cash box)
      if (p.payment_type === 'نقدي') {
        addTreasuryEntry(date, 'وارد', `مبيعات - فاتورة ${invoice_number}`, p.amount, 'الصندوق', 'sale', saleId, user);
      }
      // Bank transfer -> Treasury (bank)
      if (p.payment_type === 'تحويل') {
        addTreasuryEntry(date, 'وارد', `مبيعات (تحويل) - فاتورة ${invoice_number}`, p.amount, 'البنك', 'sale', saleId, user);
      }
      // TPE -> Treasury (bank)
      if (p.payment_type === 'TPE') {
        addTreasuryEntry(date, 'وارد', `مبيعات (TPE) - فاتورة ${invoice_number}`, p.amount, 'البنك', 'sale', saleId, user);
      }
      // Check -> Portfolio for collection
      if (p.payment_type === 'شيك') {
        db.prepare(`INSERT INTO checks_portfolio (check_number, date, from_client, amount, due_date, bank, status, source) VALUES (?, ?, ?, ?, ?, ?, 'معلق', 'مبيعات')`).run(p.check_number, date, client_name || 'عميل عابر', p.amount, p.check_due_date, p.bank);
      }
      // Debt (آجل) -> Update client balance
      if (p.payment_type === 'آجل' && client_id) {
        db.prepare('UPDATE clients SET balance = balance + ? WHERE id = ?').run(p.amount, client_id);
      }
    });
    logAudit('sales', saleId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: saleId, invoice_number, subtotal, discount_amount, final_amount });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/sales/:id', (req, res) => {
  try {
    const { user, reason } = req.body;
    if (user !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM sales_items WHERE sale_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sales_payments WHERE sale_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    logAudit('sales', req.params.id, 'delete', sale, null, user, reason);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - SPECIAL ORDERS
// ============================================

app.get('/api/special-orders', (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT so.*, cc.code as color_code, st.name as service_name, s.invoice_number FROM special_orders so LEFT JOIN color_codes cc ON so.color_code_id = cc.id LEFT JOIN service_types st ON so.service_type_id = st.id LEFT JOIN sales s ON so.sale_id = s.id`;
    if (status) sql += ` WHERE so.status = '${status}'`;
    sql += ' ORDER BY so.date DESC';
    res.json(db.prepare(sql).all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/special-orders', (req, res) => {
  try {
    const { order_number, sale_id, date, client_id, client_name, client_phone, color_code_id, temp_color_description, service_type_id, quantity, unit_price, total_price, notes } = req.body;
    if (!client_phone) return res.status(400).json({ error: 'رقم الهاتف إجباري للطلبيات الخاصة' });
    const result = db.prepare(`INSERT INTO special_orders (order_number, sale_id, date, client_id, client_name, client_phone, color_code_id, temp_color_description, service_type_id, quantity, unit_price, total_price, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'قيد_التحضير')`).run(order_number, sale_id, date, client_id, client_name, client_phone, color_code_id, temp_color_description, service_type_id, quantity, unit_price, total_price, notes);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/special-orders/:id', (req, res) => {
  try {
    const { color_code_id, status, manufacturing_order_id, user } = req.body;
    const old = db.prepare('SELECT * FROM special_orders WHERE id = ?').get(req.params.id);
    let sql = 'UPDATE special_orders SET ', updates = [], values = [];
    if (color_code_id !== undefined) { updates.push('color_code_id = ?'); values.push(color_code_id); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (manufacturing_order_id !== undefined) { updates.push('manufacturing_order_id = ?'); values.push(manufacturing_order_id); }
    sql += updates.join(', ') + ' WHERE id = ?'; values.push(req.params.id);
    db.prepare(sql).run(...values);
    logAudit('special_orders', req.params.id, 'update', old, req.body, user || 'system');
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - PURCHASES
// ============================================

app.get('/api/purchases', (req, res) => {
  try {
    const { from_date, to_date, supplier_id, period } = req.query;

    let dateFilter = '';
    const params = [];

    if (period === 'daily') {
      dateFilter = `AND date(p.date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(p.date) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(p.date) >= date('now', '-30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND p.date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (supplier_id) {
      dateFilter += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    const purchases = db.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1 ${dateFilter}
      ORDER BY p.date DESC
    `).all(...params);

    // Get items and payments for each purchase
    purchases.forEach(purchase => {
      purchase.items = db.prepare(`SELECT * FROM purchases_items WHERE purchase_id = ?`).all(purchase.id);
      purchase.payments = db.prepare(`SELECT * FROM purchases_payments WHERE purchase_id = ?`).all(purchase.id);

      // Calculate totals
      purchase.total_paid = purchase.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      purchase.remaining = purchase.total_amount - purchase.total_paid;
    });

    // Calculate KPIs
    const kpis = {
      total_purchases: purchases.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      total_paid: purchases.reduce((sum, p) => sum + parseFloat(p.total_paid || 0), 0),
      total_remaining: purchases.reduce((sum, p) => sum + parseFloat(p.remaining || 0), 0),
      count: purchases.length
    };

    res.json({ purchases, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/purchases', (req, res) => {
  try {
    const { invoice_number, date, supplier_id, supplier_name, items, payments, notes, user } = req.body;
    const total_amount = items.reduce((sum, item) => sum + item.total_cost, 0);
    const purchaseResult = db.prepare(`INSERT INTO purchases (invoice_number, date, supplier_id, supplier_name, total_amount, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(invoice_number, date, supplier_id, supplier_name, total_amount, notes);
    const purchaseId = purchaseResult.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO purchases_items (purchase_id, inventory_id, quantity, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)`);
    items.forEach(item => {
      insertItem.run(purchaseId, item.inventory_id, item.quantity, item.unit_cost, item.total_cost);
      db.prepare('UPDATE inventory SET quantity = quantity + ?, unit_cost = ? WHERE id = ?').run(item.quantity, item.unit_cost, item.inventory_id);
      db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by) VALUES (?, 'in', ?, ?, 'purchase', ?, ?)`).run(item.inventory_id, item.quantity, item.unit_cost, purchaseId, user || 'system');
    });
    const insertPayment = db.prepare(`INSERT INTO purchases_payments (purchase_id, payment_type, amount, check_number, check_date, check_due_date, bank, source_check_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    payments.forEach(p => {
      insertPayment.run(purchaseId, p.payment_type, p.amount, p.check_number || null, p.check_date || null, p.check_due_date || null, p.bank || null, p.source_check_id || null);
      if (p.payment_type === 'نقدي') addTreasuryEntry(date, 'صادر', `مشتريات - فاتورة ${invoice_number}`, p.amount, 'الصندوق', 'purchase', purchaseId, user);
      if (p.payment_type === 'شيك' || p.payment_type === 'شيك_مظهر') {
        db.prepare(`INSERT INTO checks_issued (check_number, date, to_supplier, amount, due_date, bank, type, source_check_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(p.check_number, date, supplier_name, p.amount, p.check_due_date, p.bank, p.payment_type === 'شيك_مظهر' ? 'مظهّر' : 'شيكاتي', p.source_check_id || null);
        if (p.source_check_id) db.prepare(`UPDATE checks_portfolio SET used_for_payment = 1, status = 'مظهّر', endorsed_to = ?, endorsed_date = ? WHERE id = ?`).run(supplier_name, date, p.source_check_id);
      }
    });
    logAudit('purchases', purchaseId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: purchaseId, invoice_number, total_amount });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - CHECKS
// ============================================

app.get('/api/checks/portfolio', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM checks_portfolio ORDER BY due_date').all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/checks/portfolio/available', (req, res) => {
  try { res.json(db.prepare(`SELECT * FROM checks_portfolio WHERE used_for_payment = 0 AND status = 'معلق' ORDER BY due_date`).all()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/checks/portfolio', (req, res) => {
  try {
    const { check_number, date, from_client, amount, due_date, bank, notes } = req.body;
    const result = db.prepare(`INSERT INTO checks_portfolio (check_number, date, from_client, amount, due_date, bank, notes, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'معلق', 'مستلم')`).run(check_number, date, from_client, amount, due_date, bank, notes);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/checks/portfolio/:id/deposit', (req, res) => {
  try {
    const check = db.prepare('SELECT * FROM checks_portfolio WHERE id = ?').get(req.params.id);
    if (!check) return res.status(404).json({ error: 'Check not found' });
    const depositDate = new Date().toISOString().split('T')[0];
    db.prepare(`UPDATE checks_portfolio SET status = 'محصّل', deposited_date = ? WHERE id = ?`).run(depositDate, req.params.id);
    addTreasuryEntry(depositDate, 'وارد', `تحصيل شيك ${check.check_number} من ${check.from_client}`, check.amount, 'البنك', 'check_deposit', req.params.id, req.body.user || 'system');
    res.json({ message: 'Check deposited successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/checks/portfolio/:id', (req, res) => {
  try { db.prepare('DELETE FROM checks_portfolio WHERE id = ?').run(req.params.id); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/checks/issued', (req, res) => {
  try {
    const { from_date, to_date, status, period } = req.query;

    let dateFilter = '';
    const params = [];

    if (period === 'daily') {
      dateFilter = `AND date(due_date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(due_date) >= date('now', '-7 days') AND date(due_date) <= date('now', '+7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(due_date) >= date('now', '-30 days') AND date(due_date) <= date('now', '+30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND due_date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (status) {
      dateFilter += ` AND status = ?`;
      params.push(status);
    }

    const checks = db.prepare(`
      SELECT * FROM checks_issued
      WHERE 1=1 ${dateFilter}
      ORDER BY due_date DESC
    `).all(...params);

    // Calculate KPIs
    const allChecks = db.prepare('SELECT * FROM checks_issued').all();
    const kpis = {
      total_count: allChecks.length,
      total_amount: allChecks.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      pending_count: allChecks.filter(c => c.status === 'معلق').length,
      pending_amount: allChecks.filter(c => c.status === 'معلق').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      paid_count: allChecks.filter(c => c.status === 'مدفوع').length,
      paid_amount: allChecks.filter(c => c.status === 'مدفوع').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      endorsed_count: allChecks.filter(c => c.type === 'مظهّر').length,
      endorsed_amount: allChecks.filter(c => c.type === 'مظهّر').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
    };

    res.json({ checks, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add/Update check issued
app.post('/api/checks/issued', (req, res) => {
  try {
    const { check_number, date, received_date, check_owner, to_supplier, amount, due_date, bank, notes, type } = req.body;
    const result = db.prepare(`
      INSERT INTO checks_issued (check_number, date, received_date, check_owner, to_supplier, amount, due_date, bank, notes, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'معلق')
    `).run(check_number, date, received_date || null, check_owner || null, to_supplier, amount, due_date, bank, notes, type || 'شيكاتي');
    logAudit('checks_issued', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/checks/issued/:id', (req, res) => {
  try {
    const { status, paid_date, check_owner, received_date } = req.body;
    const checkId = req.params.id;
    const old = db.prepare('SELECT * FROM checks_issued WHERE id = ?').get(checkId);

    let updates = [], values = [];
    if (status) { updates.push('status = ?'); values.push(status); }
    if (paid_date) { updates.push('paid_date = ?'); values.push(paid_date); }
    if (check_owner !== undefined) { updates.push('check_owner = ?'); values.push(check_owner); }
    if (received_date !== undefined) { updates.push('received_date = ?'); values.push(received_date); }

    if (updates.length > 0) {
      db.prepare(`UPDATE checks_issued SET ${updates.join(', ')} WHERE id = ?`).run(...values, checkId);
    }

    logAudit('checks_issued', checkId, 'update', old, req.body, req.body.user || 'system');
    res.json({ id: checkId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Pay issued check with accounting entry
app.put('/api/checks/issued/:id/pay', (req, res) => {
  try {
    const { payment_source, paid_date, user } = req.body;
    const checkId = req.params.id;

    // Validate payment source
    if (!payment_source || !['الصندوق', 'البنك'].includes(payment_source)) {
      return res.status(400).json({ error: 'يجب تحديد مصدر الدفع (الصندوق أو البنك)' });
    }

    const check = db.prepare('SELECT * FROM checks_issued WHERE id = ?').get(checkId);
    if (!check) return res.status(404).json({ error: 'الشيك غير موجود' });
    if (check.status === 'مدفوع') return res.status(400).json({ error: 'الشيك مدفوع بالفعل' });

    const payDate = paid_date || new Date().toISOString().split('T')[0];

    // Update check status
    db.prepare(`UPDATE checks_issued SET status = 'مدفوع', paid_date = ? WHERE id = ?`).run(payDate, checkId);

    // Create treasury entry (debit from cash or bank)
    addTreasuryEntry(
      payDate,
      'صادر',
      `دفع شيك ${check.check_number} - ${check.to_supplier}`,
      check.amount,
      payment_source,
      'check_payment',
      checkId,
      user || 'system'
    );

    logAudit('checks_issued', checkId, 'update', check, { status: 'مدفوع', payment_source, paid_date: payDate }, user || 'system', 'Check paid');
    res.json({ message: 'تم دفع الشيك بنجاح', check_id: checkId, amount: check.amount, source: payment_source });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// TREASURY API (READ-ONLY + COMPUTED)
// ============================================

app.get('/api/treasury/balance', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    let cash = parseFloat(ob.cash || 0), bank = parseFloat(ob.bank || 0);
    ledger.forEach(e => { const amt = parseFloat(e.amount || 0); if (e.type === 'وارد') { if (e.account === 'الصندوق') cash += amt; else bank += amt; } else { if (e.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    res.json({ cash, bank, total: cash + bank });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/treasury/movements', (req, res) => {
  try {
    const { from_date, to_date, account, limit } = req.query;
    let sql = 'SELECT * FROM treasury_ledger WHERE 1=1', params = [];
    if (from_date) { sql += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND date <= ?'; params.push(to_date); }
    if (account) { sql += ' AND account = ?'; params.push(account); }
    sql += ' ORDER BY date DESC, created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/treasury/summary', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0`).get();
    let cash = parseFloat(ob.cash || 0), bank = parseFloat(ob.bank || 0), cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    ledger.forEach(e => { const amt = parseFloat(e.amount || 0); if (e.type === 'وارد') { if (e.account === 'الصندوق') { cash += amt; cashIn += amt; } else { bank += amt; bankIn += amt; } } else { if (e.account === 'الصندوق') { cash -= amt; cashOut += amt; } else { bank -= amt; bankOut += amt; } } });
    res.json({ cash: { balance: cash, in: cashIn, out: cashOut }, bank: { balance: bank, in: bankIn, out: bankOut }, checksUnderCollection: parseFloat(checksPortfolio.total || 0), totalLiquid: cash + bank + parseFloat(checksPortfolio.total || 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// SIMPLE CRUD TABLES
// ============================================

// Special endpoints for clients with calculated debt
app.get('/api/clients', (req, res) => {
  try {
    // Get clients with their balance (debt)
    const clients = db.prepare(`
      SELECT c.*,
        COALESCE(c.balance, 0) as balance
      FROM clients c
      ORDER BY c.name
    `).all();
    res.json(clients);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clients', (req, res) => {
  try {
    const code = generateCode('clients');
    const { name, phone, address, allow_credit, user } = req.body;
    const result = db.prepare(`
      INSERT INTO clients (code, name, phone, address, balance, allow_credit)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(code, name, phone, address, allow_credit !== undefined ? allow_credit : 1);
    logAudit('clients', result.lastInsertRowid, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/clients/:id', (req, res) => {
  try {
    const { name, phone, address, allow_credit, user } = req.body;
    const old = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    db.prepare(`UPDATE clients SET name = ?, phone = ?, address = ?, allow_credit = ? WHERE id = ?`)
      .run(name, phone, address, allow_credit, req.params.id);
    logAudit('clients', req.params.id, 'update', old, req.body, user || 'system');
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/clients/:id', (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    logAudit('clients', req.params.id, 'delete', old, null, req.body.user || 'system');
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Tables with auto-generated codes (excluding clients which has special endpoint)
const autoCodeTables = ['suppliers', 'employees', 'partners'];
autoCodeTables.forEach(table => {
  const crud = crudWithAudit(table);
  app.get(`/api/${table}`, (req, res) => { try { res.json(crud.all()); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post(`/api/${table}`, (req, res) => {
    try {
      const code = generateCode(table);
      const data = { ...req.body, code };
      const result = crud.create(data, req.body.user || 'system');
      res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.put(`/api/${table}/:id`, (req, res) => { try { crud.update(req.params.id, req.body, req.body.user || 'system', req.body.reason); res.json({ id: req.params.id, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  app.delete(`/api/${table}/:id`, (req, res) => { try { crud.delete(req.params.id, req.body.user || 'system', req.body.reason); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); } });
});

// Tables without auto-generated codes
const simpleTables = ['vehicle_tours'];
simpleTables.forEach(table => {
  const crud = crudWithAudit(table);
  app.get(`/api/${table}`, (req, res) => { try { res.json(crud.all()); } catch (err) { res.status(500).json({ error: err.message }); } });
  app.post(`/api/${table}`, (req, res) => { try { const result = crud.create(req.body, req.body.user || 'system'); res.status(201).json({ id: result.lastInsertRowid, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  app.put(`/api/${table}/:id`, (req, res) => { try { crud.update(req.params.id, req.body, req.body.user || 'system', req.body.reason); res.json({ id: req.params.id, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  app.delete(`/api/${table}/:id`, (req, res) => { try { crud.delete(req.params.id, req.body.user || 'system', req.body.reason); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); } });
});

// Expenses endpoint
app.get('/api/expenses', (req, res) => { try { res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all()); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/expenses', (req, res) => {
  try {
    const { date, category, description, amount, payment_method, user } = req.body;
    const result = db.prepare(`INSERT INTO expenses (date, category, description, amount, payment_method) VALUES (?, ?, ?, ?, ?)`).run(date, category, description, amount, payment_method);
    const expenseId = result.lastInsertRowid;
    if (payment_method === 'نقدي') addTreasuryEntry(date, 'صادر', `${category} - ${description}`, amount, 'الصندوق', 'expense', expenseId, user);
    else if (payment_method === 'بنك') addTreasuryEntry(date, 'صادر', `${category} - ${description}`, amount, 'البنك', 'expense', expenseId, user);
    logAudit('expenses', expenseId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: expenseId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// DASHBOARD
// ============================================

app.get('/api/dashboard', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0`).get();
    let cash = parseFloat(ob.cash || 0), bank = parseFloat(ob.bank || 0);
    ledger.forEach(t => { const amt = parseFloat(t.amount || 0); if (t.type === 'وارد') { if (t.account === 'الصندوق') cash += amt; else bank += amt; } else { if (t.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    const checksUnderCollection = parseFloat(checksPortfolio.total || 0);
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients').get();
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers').get();
    const salesData = db.prepare('SELECT SUM(subtotal) as subtotal, SUM(discount_amount) as discounts, SUM(final_amount) as net FROM sales').get();
    const purchases = db.prepare('SELECT SUM(total_amount) as total FROM purchases').get();
    const expenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get();
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory').get();
    const grossSales = parseFloat(salesData.subtotal || 0), salesDiscounts = parseFloat(salesData.discounts || 0), netSales = parseFloat(salesData.net || 0);
    const totalPurchases = parseFloat(purchases.total || 0), totalExpenses = parseFloat(expenses.total || 0);
    res.json({ cash, bank, checksUnderCollection, totalLiquid: cash + bank + checksUnderCollection, inventoryValue: parseFloat(inventory.total || 0), clientsDebt: parseFloat(clients.total || 0), suppliersDebt: parseFloat(suppliers.total || 0), grossSales, salesDiscounts, netSales, totalPurchases, totalExpenses, netProfit: netSales - totalPurchases - totalExpenses });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// REPORTS
// ============================================

app.get('/api/reports/balance-sheet', (req, res) => {
  try {
    const { year } = req.query;
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get() || { cash: 0, bank: 0 };
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0`).get();
    let cash = parseFloat(ob.cash || 0), bank = parseFloat(ob.bank || 0);
    ledger.forEach(t => { const amt = parseFloat(t.amount || 0); if (t.type === 'وارد') { if (t.account === 'الصندوق') cash += amt; else bank += amt; } else { if (t.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory').get();
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients').get();
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers').get();
    const partners = db.prepare('SELECT SUM(initial_capital) as total FROM partners').get();
    const assets = { cash, bank, checks: parseFloat(checksPortfolio?.total || 0), inventory: parseFloat(inventory?.total || 0), clientsDebt: parseFloat(clients?.total || 0), total: cash + bank + parseFloat(checksPortfolio?.total || 0) + parseFloat(inventory?.total || 0) + parseFloat(clients?.total || 0) };
    const liabilities = { suppliersDebt: parseFloat(suppliers?.total || 0), total: parseFloat(suppliers?.total || 0) };
    const equity = { capital: parseFloat(partners?.total || 0), total: parseFloat(partners?.total || 0) };
    res.json({ assets, liabilities, equity, year: year || new Date().getFullYear() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/income-statement', (req, res) => {
  try {
    const { year } = req.query;
    const salesData = db.prepare('SELECT SUM(subtotal) as gross, SUM(discount_amount) as discounts, SUM(final_amount) as net FROM sales').get() || { gross: 0, discounts: 0, net: 0 };
    const purchases = db.prepare('SELECT SUM(total_amount) as total FROM purchases').get();
    const expenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get();
    const manufacturing = db.prepare(`SELECT SUM(total_cost) as total FROM manufacturing_orders WHERE status = 'مكتمل'`).get();
    const grossSales = parseFloat(salesData?.gross || 0), salesDiscounts = parseFloat(salesData?.discounts || 0), netSales = parseFloat(salesData?.net || 0);
    const costOfGoods = parseFloat(purchases?.total || 0) + parseFloat(manufacturing?.total || 0);
    const operatingExpenses = parseFloat(expenses?.total || 0);
    const netProfit = netSales - costOfGoods - operatingExpenses;
    res.json({ revenue: { gross_sales: grossSales, less_sales_discounts: salesDiscounts, net_sales: netSales, total: netSales }, cost_of_goods: { purchases: parseFloat(purchases?.total || 0), manufacturing: parseFloat(manufacturing?.total || 0), total: costOfGoods }, gross_profit: netSales - costOfGoods, expenses: { operating: operatingExpenses, total: operatingExpenses }, net_profit: netProfit, year: year || new Date().getFullYear() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports/distribute-profit', (req, res) => {
  try {
    const { fiscal_year, net_profit } = req.body;
    const partners = db.prepare('SELECT * FROM partners WHERE active = 1').all();
    const distributions = [];
    partners.forEach(partner => {
      const share_amount = net_profit * (partner.share_percent / 100);
      db.prepare(`INSERT INTO profit_distributions (fiscal_year, partner_id, net_profit, share_percent, share_amount) VALUES (?, ?, ?, ?, ?)`).run(fiscal_year, partner.id, net_profit, partner.share_percent, share_amount);
      distributions.push({ partner_id: partner.id, partner_name: partner.name, share_percent: partner.share_percent, share_amount });
    });
    res.json({ fiscal_year, net_profit, distributions });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/reports/manufacturing-cost-analysis', (req, res) => {
  try {
    const orders = db.prepare(`SELECT mo.*, cc.code as color_code, st.name as service_name, st.overhead_rate, a.name as artisan_name FROM manufacturing_orders mo LEFT JOIN color_codes cc ON mo.color_code_id = cc.id LEFT JOIN service_types st ON mo.service_type_id = st.id LEFT JOIN artisans a ON mo.artisan_id = a.id WHERE mo.status = 'مكتمل' ORDER BY mo.completed_at DESC`).all();
    const summary = { total_orders: orders.length, total_material_cost: orders.reduce((s, o) => s + parseFloat(o.total_material_cost || 0), 0), total_labor_cost: orders.reduce((s, o) => s + parseFloat(o.total_labor_cost || 0), 0), total_overhead_cost: orders.reduce((s, o) => s + parseFloat(o.overhead_cost || 0), 0), total_cost: orders.reduce((s, o) => s + parseFloat(o.total_cost || 0), 0), avg_unit_cost: orders.length > 0 ? orders.reduce((s, o) => s + parseFloat(o.unit_cost || 0), 0) / orders.length : 0 };
    res.json({ summary, orders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// API for product images (categories with products)
app.get('/api/inventory/by-category', (req, res) => {
  try {
    const inventory = db.prepare(`
      SELECT i.*, w.name as warehouse_name, pt.name as product_name, pt.category, pt.unit,
             cc.code as color_code, cc.main_color, cc.shade
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes cc ON i.color_code_id = cc.id
      WHERE i.quantity > 0
      ORDER BY pt.category, pt.name, cc.code
    `).all();

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

app.get('/api/reports/inventory-valuation', (req, res) => {
  try {
    const valuation = db.prepare(`SELECT i.id, i.warehouse_id, i.product_type_id, i.color_code_id, w.name as warehouse_name, pt.name as product_name, cc.code as color_code, i.quantity as snapshot_quantity, SUM(CASE WHEN im.movement_type = 'in' THEN im.quantity WHEN im.movement_type = 'out' THEN -im.quantity END) as actual_quantity, AVG(CASE WHEN im.movement_type = 'in' THEN im.unit_cost END) as avg_cost FROM inventory i LEFT JOIN inventory_movements im ON i.id = im.inventory_id LEFT JOIN warehouses w ON i.warehouse_id = w.id LEFT JOIN product_types pt ON i.product_type_id = pt.id LEFT JOIN color_codes cc ON i.color_code_id = cc.id GROUP BY i.id`).all();
    const total_value = valuation.reduce((sum, item) => sum + (parseFloat(item.actual_quantity || 0) * parseFloat(item.avg_cost || 0)), 0);
    res.json({ valuation, total_value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// AUDIT LOG
// ============================================

app.get('/api/audit/log', (req, res) => {
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

// ============================================
// OPENING BALANCES
// ============================================

app.get('/api/opening-balances', (req, res) => { try { res.json(db.prepare('SELECT * FROM opening_balances WHERE id = 1').get()); } catch (err) { res.status(500).json({ error: err.message }); } });

app.put('/api/opening-balances', (req, res) => {
  try {
    const { cash, bank, fiscal_year, user } = req.body;
    const old = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    db.prepare(`UPDATE opening_balances SET cash = ?, bank = ?, fiscal_year = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(cash, bank, fiscal_year);
    logAudit('opening_balances', 1, 'update', old, req.body, user || 'system');
    res.json(req.body);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use('/api/*', (req, res) => { res.status(404).json({ error: 'API endpoint not found' }); });
app.use((err, req, res, next) => { console.error('Error:', err); res.status(500).json({ error: err.message || 'Internal server error' }); });

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🏭 PROFESSIONAL ERP ACCOUNTING SYSTEM v2.5 (REFINED)         ║
║                                                                ║
║   📊 Dashboard:     http://localhost:${PORT}                      ║
║   🔌 API:           http://localhost:${PORT}/api/dashboard        ║
║   💾 Database:      ${DB_PATH}                    ║
║                                                                ║
║   ✅ NEW IN v2.5 (Refined TDWAR System):                       ║
║      - Single source of truth: TDWAR only (old screen disabled)║
║      - Labor cost = actual production × price (NOT expected)   ║
║      - Waste auto-calculated (expected - actual)               ║
║      - SABRA auto-created with same color as BOBINE            ║
║      - JAAB (bags) optional: can be 0                          ║
║      - Artisan expenses/advances with treasury integration     ║
║      - Simplified artisan screen with payment button           ║
║      - Reduced duplicate screens                               ║
║                                                                ║
║   ✅ FROM v2.4:                                                ║
║      - TDWAR production system, artisan dashboard              ║
║                                                                ║
║   ✅ Modules:                                                  ║
║      - Color Codes (inline creation)                           ║
║      - Advanced Inventory                                      ║
║      - Manufacturing with material tracking                    ║
║      - POS System with constraints                             ║
║      - Professional Check Management                           ║
║      - Treasury Ledger (read-only)                             ║
║      - Financial Reports (accurate)                            ║
║      - Complete Audit Log                                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => { console.log('Shutting down gracefully...'); db.close(); process.exit(0); });
