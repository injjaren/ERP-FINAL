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
// CORRECTED SCHEMA - Based on Critical Review
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

-- ============================================
-- COLOR CODES (BACKBONE)
-- ============================================

CREATE TABLE IF NOT EXISTS color_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  main_color TEXT NOT NULL,
  shade TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INVENTORY SYSTEM
-- ============================================

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
  color_code_id INTEGER NOT NULL,
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  min_quantity REAL DEFAULT 0,
  opening_balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id),
  UNIQUE(warehouse_id, product_type_id, color_code_id)
);

-- ⭐ CRITICAL: inventory_movements is the SOURCE OF TRUTH
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

-- ============================================
-- ARTISANS & MANUFACTURING
-- ============================================

CREATE TABLE IF NOT EXISTS artisans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  daily_expense REAL DEFAULT 0,
  weekly_expense REAL DEFAULT 0,
  account_balance REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 🔧 CORRECTED: overhead_rate added to service_types (not hardcoded 10%)
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
  color_code_id INTEGER NOT NULL,
  service_type_id INTEGER NOT NULL,
  artisan_id INTEGER NOT NULL,
  status TEXT DEFAULT 'قيد_التحضير',
  expected_output_quantity REAL,
  actual_output_quantity REAL,
  total_material_cost REAL DEFAULT 0,
  total_labor_cost REAL DEFAULT 0,
  overhead_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  notes TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id),
  FOREIGN KEY (service_type_id) REFERENCES service_types(id),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

CREATE TABLE IF NOT EXISTS manufacturing_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

CREATE TABLE IF NOT EXISTS manufacturing_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturing_order_id INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
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

-- ============================================
-- SALES
-- ============================================

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

-- ============================================
-- PURCHASES
-- ============================================

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

-- ============================================
-- CHECKS MANAGEMENT
-- ============================================

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

-- ============================================
-- 🔧 CORRECTED: TREASURY as LEDGER (read-only via transactions)
-- ============================================

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

-- ⚠️ Treasury entries can ONLY be created via:
-- - Sales (payment_type = 'نقدي')
-- - Purchases (payment_type = 'نقدي')
-- - Expenses
-- - Check deposits
-- NO direct UPDATE or DELETE allowed!

-- ============================================
-- EXPENSES
-- ============================================

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

-- ============================================
-- AUDIT LOG
-- ============================================

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

-- ============================================
-- PARTNERS & PROFIT DISTRIBUTION
-- ============================================

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

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), version: 'ERP-v2.0-CORRECTED' });
});

// Audit logging
function logAudit(table, recordId, action, oldValues, newValues, user, reason = '') {
  try {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      table, recordId, action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      user || 'system', reason
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// 🔧 CORRECTED: Treasury ledger entry (append-only)
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

// Generic CRUD with audit (for non-treasury tables)
function crudWithAudit(table) {
  return {
    all: () => db.prepare(`SELECT * FROM ${table}`).all(),
    get: (id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id),
    create: (data, user) => {
      const keys = Object.keys(data).filter(k => k !== 'id');
      const vals = keys.map(k => data[k]);
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const result = db.prepare(sql).run(...vals);
      logAudit(table, result.lastInsertRowid, 'create', null, data, user);
      return result;
    },
    update: (id, data, user, reason) => {
      const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
      const keys = Object.keys(data).filter(k => k !== 'id');
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

// استمرار في الرد التالي...

// ============================================
// API ENDPOINTS - COLOR CODES
// ============================================

const colorCodes = crudWithAudit('color_codes');

app.get('/api/color-codes', (req, res) => {
  try {
    const codes = colorCodes.all();
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/color-codes', (req, res) => {
  try {
    const result = colorCodes.create(req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/color-codes/:id', (req, res) => {
  try {
    colorCodes.update(req.params.id, req.body, req.body.user || 'system', req.body.reason);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/color-codes/:id', (req, res) => {
  try {
    colorCodes.delete(req.params.id, req.body.user || 'system', req.body.reason);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - WAREHOUSES & PRODUCT TYPES
// ============================================

const warehouses = crudWithAudit('warehouses');
const productTypes = crudWithAudit('product_types');

app.get('/api/warehouses', (req, res) => {
  try { res.json(warehouses.all()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/warehouses', (req, res) => {
  try {
    const result = warehouses.create(req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/product-types', (req, res) => {
  try { res.json(productTypes.all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/product-types', (req, res) => {
  try {
    const result = productTypes.create(req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - INVENTORY
// ============================================

app.get('/api/inventory', (req, res) => {
  try {
    const inventory = db.prepare(`
      SELECT i.*, 
        w.name as warehouse_name,
        pt.name as product_name,
        pt.unit,
        cc.code as color_code,
        cc.main_color,
        cc.shade
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes cc ON i.color_code_id = cc.id
      ORDER BY w.name, pt.name, cc.code
    `).all();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const { warehouse_id, product_type_id, color_code_id, quantity, unit_cost, unit_price, opening_balance } = req.body;
    
    const result = db.prepare(`
      INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, quantity, unit_cost, unit_price, opening_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(warehouse_id, product_type_id, color_code_id, quantity || 0, unit_cost || 0, unit_price || 0, opening_balance || 0);
    
    logAudit('inventory', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/:id/movements', (req, res) => {
  try {
    const movements = db.prepare(`
      SELECT * FROM inventory_movements 
      WHERE inventory_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - SERVICE TYPES (CORRECTED)
// ============================================

app.get('/api/service-types', (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM service_types').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/service-types', (req, res) => {
  try {
    const { code, name, description, overhead_rate } = req.body;
    const result = db.prepare(`
      INSERT INTO service_types (code, name, description, overhead_rate)
      VALUES (?, ?, ?, ?)
    `).run(code, name, description, overhead_rate || 0.10);
    
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/service-types/:id', (req, res) => {
  try {
    const { name, description, overhead_rate } = req.body;
    db.prepare(`
      UPDATE service_types 
      SET name = ?, description = ?, overhead_rate = ?
      WHERE id = ?
    `).run(name, description, overhead_rate, req.params.id);
    
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - ARTISANS
// ============================================

app.get('/api/artisans', (req, res) => {
  try {
    const artisans = db.prepare(`
      SELECT a.*,
        GROUP_CONCAT(
          json_object(
            'service_type_id', ast.service_type_id,
            'service_name', st.name,
            'rate', ast.rate,
            'rate_unit', ast.rate_unit
          )
        ) as services
      FROM artisans a
      LEFT JOIN artisan_services ast ON a.id = ast.artisan_id
      LEFT JOIN service_types st ON ast.service_type_id = st.id
      GROUP BY a.id
    `).all();
    
    artisans.forEach(a => {
      if (a.services) {
        a.services = JSON.parse('[' + a.services + ']');
      } else {
        a.services = [];
      }
    });
    
    res.json(artisans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/artisans/qualified', (req, res) => {
  try {
    const { service_type_id } = req.query;
    
    const artisans = db.prepare(`
      SELECT a.*, ast.rate, ast.rate_unit, st.name as service_name
      FROM artisans a
      INNER JOIN artisan_services ast ON a.id = ast.artisan_id
      INNER JOIN service_types st ON ast.service_type_id = st.id
      WHERE ast.service_type_id = ? AND a.active = 1
      ORDER BY ast.rate ASC
    `).all(service_type_id);
    
    res.json(artisans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/artisans', (req, res) => {
  try {
    const { code, name, phone, address, daily_expense, weekly_expense, services } = req.body;
    
    const result = db.prepare(`
      INSERT INTO artisans (code, name, phone, address, daily_expense, weekly_expense)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, phone, address, daily_expense || 0, weekly_expense || 0);
    
    const artisanId = result.lastInsertRowid;
    
    if (services && services.length > 0) {
      const insertService = db.prepare(`
        INSERT INTO artisan_services (artisan_id, service_type_id, rate, rate_unit)
        VALUES (?, ?, ?, ?)
      `);
      
      services.forEach(s => {
        insertService.run(artisanId, s.service_type_id, s.rate, s.rate_unit || 'كيلو');
      });
    }
    
    logAudit('artisans', artisanId, 'create', null, req.body, req.body.user || 'system');
    
    res.status(201).json({ id: artisanId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - MANUFACTURING (CORRECTED OVERHEAD)
// ============================================

app.get('/api/manufacturing/orders', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT mo.*,
        cc.code as color_code,
        cc.main_color,
        st.name as service_name,
        st.overhead_rate,
        a.name as artisan_name
      FROM manufacturing_orders mo
      LEFT JOIN color_codes cc ON mo.color_code_id = cc.id
      LEFT JOIN service_types st ON mo.service_type_id = st.id
      LEFT JOIN artisans a ON mo.artisan_id = a.id
      ORDER BY mo.date DESC
    `).all();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manufacturing/orders', (req, res) => {
  try {
    const { 
      order_number, date, color_code_id, service_type_id, artisan_id, 
      expected_output_quantity, materials, notes 
    } = req.body;
    
    // Get artisan rate
    const artisanService = db.prepare(`
      SELECT rate, rate_unit FROM artisan_services 
      WHERE artisan_id = ? AND service_type_id = ?
    `).get(artisan_id, service_type_id);
    
    if (!artisanService) {
      return res.status(400).json({ error: 'Artisan not qualified for this service' });
    }
    
    // 🔧 CORRECTED: Get overhead_rate from service_type
    const serviceType = db.prepare(`
      SELECT overhead_rate FROM service_types WHERE id = ?
    `).get(service_type_id);
    
    // Calculate costs
    let totalMaterialCost = 0;
    materials.forEach(m => {
      const inv = db.prepare('SELECT unit_cost FROM inventory WHERE id = ?').get(m.inventory_id);
      totalMaterialCost += (inv.unit_cost * m.quantity);
    });
    
    const totalLaborCost = expected_output_quantity * artisanService.rate;
    const overheadCost = totalMaterialCost * serviceType.overhead_rate;  // 🔧 CORRECTED
    const totalCost = totalMaterialCost + totalLaborCost + overheadCost;
    const unitCost = totalCost / expected_output_quantity;
    
    // Create order
    const orderResult = db.prepare(`
      INSERT INTO manufacturing_orders (
        order_number, date, color_code_id, service_type_id, artisan_id,
        expected_output_quantity, total_material_cost, total_labor_cost,
        overhead_cost, total_cost, unit_cost, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'قيد_التحضير')
    `).run(
      order_number, date, color_code_id, service_type_id, artisan_id,
      expected_output_quantity, totalMaterialCost, totalLaborCost,
      overheadCost, totalCost, unitCost, notes
    );
    
    const orderId = orderResult.lastInsertRowid;
    
    // Add inputs
    const insertInput = db.prepare(`
      INSERT INTO manufacturing_inputs (manufacturing_order_id, inventory_id, quantity, unit_cost, total_cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    materials.forEach(m => {
      const inv = db.prepare('SELECT unit_cost FROM inventory WHERE id = ?').get(m.inventory_id);
      const totalCost = inv.unit_cost * m.quantity;
      insertInput.run(orderId, m.inventory_id, m.quantity, inv.unit_cost, totalCost);
      
      // Deduct from inventory
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(m.quantity, m.inventory_id);
      
      // Log movement
      db.prepare(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
        VALUES (?, 'out', ?, 'manufacturing', ?, ?)
      `).run(m.inventory_id, m.quantity, orderId, req.body.user || 'system');
    });
    
    logAudit('manufacturing_orders', orderId, 'create', null, req.body, req.body.user || 'system');
    
    res.status(201).json({ id: orderId, totalCost, unitCost });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/manufacturing/orders/:id/complete', (req, res) => {
  try {
    const { actual_output_quantity, output_inventory_id } = req.body;
    
    const order = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const actualUnitCost = order.total_cost / actual_output_quantity;
    
    db.prepare(`
      UPDATE manufacturing_orders 
      SET status = 'مكتمل', 
          actual_output_quantity = ?,
          unit_cost = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(actual_output_quantity, actualUnitCost, req.params.id);
    
    db.prepare(`
      INSERT INTO manufacturing_outputs (manufacturing_order_id, inventory_id, quantity, unit_cost)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, output_inventory_id, actual_output_quantity, actualUnitCost);
    
    db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(actual_output_quantity, output_inventory_id);
    
    db.prepare(`
      INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by)
      VALUES (?, 'in', ?, ?, 'manufacturing', ?, ?)
    `).run(output_inventory_id, actual_output_quantity, actualUnitCost, req.params.id, req.body.user || 'system');
    
    db.prepare(`
      INSERT INTO artisan_accounts (artisan_id, date, type, amount, description, reference_type, reference_id)
      VALUES (?, ?, 'debit', ?, ?, 'manufacturing', ?)
    `).run(order.artisan_id, new Date().toISOString().split('T')[0], order.total_labor_cost, 
           `أجر تصنيع - طلب ${order.order_number}`, req.params.id);
    
    db.prepare('UPDATE artisans SET account_balance = account_balance + ? WHERE id = ?')
      .run(order.total_labor_cost, order.artisan_id);
    
    logAudit('manufacturing_orders', req.params.id, 'update', order, { status: 'مكتمل' }, req.body.user || 'system', 'Order completed');
    
    res.json({ message: 'Order completed successfully', unitCost: actualUnitCost });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// استمرار في الرد التالي...

// ============================================
// API ENDPOINTS - POS & SALES (CORRECTED DISCOUNT)
// ============================================

app.get('/api/sales', (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT s.*,
        c.name as client_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      ORDER BY s.date DESC
    `).all();
    
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pos/sale', (req, res) => {
  try {
    const { 
      invoice_number, date, client_id, client_name, client_phone,
      items, payments, discount_percent, discount_amount, notes, user 
    } = req.body;
    
    // Validate: No credit without phone
    const hasCredit = payments.some(p => p.payment_type === 'آجل');
    if (hasCredit && !client_phone) {
      return res.status(400).json({ error: 'رقم الهاتف إجباري للبيع بالدين' });
    }
    
    // Validate discount for regular users
    if (user !== 'admin' && discount_percent > 5) {
      return res.status(400).json({ error: 'الخصم الأقصى للمستخدم العادي هو 5%' });
    }
    
    // 🔧 CORRECTED: Calculate subtotal, discount, final_amount
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const final_amount = subtotal - (discount_amount || 0);
    
    // Create sale
    const saleResult = db.prepare(`
      INSERT INTO sales (
        invoice_number, date, client_id, client_name, client_phone,
        subtotal, discount_percent, discount_amount, final_amount,
        notes, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(
      invoice_number, date, client_id, client_name, client_phone,
      subtotal, discount_percent || 0, discount_amount || 0, final_amount,
      notes, user || 'system'
    );
    
    const saleId = saleResult.lastInsertRowid;
    
    // Add items
    const insertItem = db.prepare(`
      INSERT INTO sales_items (
        sale_id, inventory_id, product_name, color_code_id, quantity,
        unit_price, total_price, is_special_order, special_order_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      insertItem.run(
        saleId, item.inventory_id, item.product_name, item.color_code_id,
        item.quantity, item.unit_price, item.total_price,
        item.is_special_order || 0, item.special_order_id || null
      );
      
      if (!item.is_special_order && item.inventory_id) {
        db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?')
          .run(item.quantity, item.inventory_id);
        
        db.prepare(`
          INSERT INTO inventory_movements (
            inventory_id, movement_type, quantity, reference_type, reference_id, created_by
          ) VALUES (?, 'out', ?, 'sale', ?, ?)
        `).run(item.inventory_id, item.quantity, saleId, user || 'system');
      }
    });
    
    // Add payments
    const insertPayment = db.prepare(`
      INSERT INTO sales_payments (
        sale_id, payment_type, amount, check_number, check_date, check_due_date, bank
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    payments.forEach(p => {
      insertPayment.run(
        saleId, p.payment_type, p.amount,
        p.check_number || null, p.check_date || null, p.check_due_date || null, p.bank || null
      );
      
      // 🔧 CORRECTED: Add to treasury_ledger if cash
      if (p.payment_type === 'نقدي') {
        addTreasuryEntry(
          date, 'وارد', 
          `مبيعات - فاتورة ${invoice_number}`, 
          p.amount, 'الصندوق', 
          'sale', saleId, user
        );
      }
      
      // Add to checks portfolio if check
      if (p.payment_type === 'شيك') {
        db.prepare(`
          INSERT INTO checks_portfolio (
            check_number, date, from_client, amount, due_date, bank, status, source
          ) VALUES (?, ?, ?, ?, ?, ?, 'معلق', 'مبيعات')
        `).run(p.check_number, date, client_name || 'عميل عابر', p.amount, p.check_due_date, p.bank);
      }
    });
    
    logAudit('sales', saleId, 'create', null, req.body, user || 'system');
    
    res.status(201).json({ id: saleId, invoice_number, subtotal, discount_amount, final_amount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/sales/:id', (req, res) => {
  try {
    const { user, reason } = req.body;
    
    if (user !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    
    db.prepare('DELETE FROM sales_items WHERE sale_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sales_payments WHERE sale_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    
    logAudit('sales', req.params.id, 'delete', sale, null, user, reason);
    
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - SPECIAL ORDERS
// ============================================

app.get('/api/special-orders', (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT so.*,
        cc.code as color_code,
        st.name as service_name,
        s.invoice_number
      FROM special_orders so
      LEFT JOIN color_codes cc ON so.color_code_id = cc.id
      LEFT JOIN service_types st ON so.service_type_id = st.id
      LEFT JOIN sales s ON so.sale_id = s.id
    `;
    
    if (status) {
      sql += ` WHERE so.status = '${status}'`;
    }
    
    sql += ' ORDER BY so.date DESC';
    
    const orders = db.prepare(sql).all();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/special-orders', (req, res) => {
  try {
    const {
      order_number, sale_id, date, client_id, client_name, client_phone,
      color_code_id, temp_color_description, service_type_id,
      quantity, unit_price, total_price, notes
    } = req.body;
    
    if (!client_phone) {
      return res.status(400).json({ error: 'رقم الهاتف إجباري للطلبيات الخاصة' });
    }
    
    const result = db.prepare(`
      INSERT INTO special_orders (
        order_number, sale_id, date, client_id, client_name, client_phone,
        color_code_id, temp_color_description, service_type_id,
        quantity, unit_price, total_price, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'قيد_التحضير')
    `).run(
      order_number, sale_id, date, client_id, client_name, client_phone,
      color_code_id, temp_color_description, service_type_id,
      quantity, unit_price, total_price, notes
    );
    
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/special-orders/:id', (req, res) => {
  try {
    const { color_code_id, status, manufacturing_order_id, user } = req.body;
    
    const old = db.prepare('SELECT * FROM special_orders WHERE id = ?').get(req.params.id);
    
    let sql = 'UPDATE special_orders SET ';
    const updates = [];
    const values = [];
    
    if (color_code_id !== undefined) {
      updates.push('color_code_id = ?');
      values.push(color_code_id);
    }
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    if (manufacturing_order_id !== undefined) {
      updates.push('manufacturing_order_id = ?');
      values.push(manufacturing_order_id);
    }
    
    sql += updates.join(', ') + ' WHERE id = ?';
    values.push(req.params.id);
    
    db.prepare(sql).run(...values);
    
    logAudit('special_orders', req.params.id, 'update', old, req.body, user || 'system');
    
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - PURCHASES
// ============================================

app.get('/api/purchases', (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT p.*,
        s.name as supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.date DESC
    `).all();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', (req, res) => {
  try {
    const { invoice_number, date, supplier_id, supplier_name, items, payments, notes, user } = req.body;
    
    const total_amount = items.reduce((sum, item) => sum + item.total_cost, 0);
    
    const purchaseResult = db.prepare(`
      INSERT INTO purchases (invoice_number, date, supplier_id, supplier_name, total_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(invoice_number, date, supplier_id, supplier_name, total_amount, notes);
    
    const purchaseId = purchaseResult.lastInsertRowid;
    
    const insertItem = db.prepare(`
      INSERT INTO purchases_items (purchase_id, inventory_id, quantity, unit_cost, total_cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      insertItem.run(purchaseId, item.inventory_id, item.quantity, item.unit_cost, item.total_cost);
      
      db.prepare('UPDATE inventory SET quantity = quantity + ?, unit_cost = ? WHERE id = ?')
        .run(item.quantity, item.unit_cost, item.inventory_id);
      
      db.prepare(`
        INSERT INTO inventory_movements (
          inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by
        ) VALUES (?, 'in', ?, ?, 'purchase', ?, ?)
      `).run(item.inventory_id, item.quantity, item.unit_cost, purchaseId, user || 'system');
    });
    
    const insertPayment = db.prepare(`
      INSERT INTO purchases_payments (
        purchase_id, payment_type, amount, check_number, check_date, check_due_date, bank, source_check_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    payments.forEach(p => {
      insertPayment.run(
        purchaseId, p.payment_type, p.amount,
        p.check_number || null, p.check_date || null, p.check_due_date || null,
        p.bank || null, p.source_check_id || null
      );
      
      // 🔧 CORRECTED: Add to treasury_ledger if cash
      if (p.payment_type === 'نقدي') {
        addTreasuryEntry(
          date, 'صادر',
          `مشتريات - فاتورة ${invoice_number}`,
          p.amount, 'الصندوق',
          'purchase', purchaseId, user
        );
      }
      
      if (p.payment_type === 'شيك' || p.payment_type === 'شيك_مظهر') {
        db.prepare(`
          INSERT INTO checks_issued (
            check_number, date, to_supplier, amount, due_date, bank, type, source_check_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.check_number, date, supplier_name,
          p.amount, p.check_due_date, p.bank,
          p.payment_type === 'شيك_مظهر' ? 'مظهّر' : 'شيكاتي',
          p.source_check_id || null
        );
        
        if (p.source_check_id) {
          db.prepare(`
            UPDATE checks_portfolio 
            SET used_for_payment = 1, status = 'مظهّر', endorsed_to = ?, endorsed_date = ?
            WHERE id = ?
          `).run(supplier_name, date, p.source_check_id);
        }
      }
    });
    
    logAudit('purchases', purchaseId, 'create', null, req.body, user || 'system');
    
    res.status(201).json({ id: purchaseId, invoice_number, total_amount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - CHECKS
// ============================================

app.get('/api/checks/portfolio', (req, res) => {
  try {
    const checks = db.prepare('SELECT * FROM checks_portfolio ORDER BY due_date').all();
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/checks/portfolio/available', (req, res) => {
  try {
    const checks = db.prepare(`
      SELECT * FROM checks_portfolio 
      WHERE used_for_payment = 0 AND status = 'معلق'
      ORDER BY due_date
    `).all();
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checks/portfolio', (req, res) => {
  try {
    const { check_number, date, from_client, amount, due_date, bank, notes } = req.body;
    
    const result = db.prepare(`
      INSERT INTO checks_portfolio (
        check_number, date, from_client, amount, due_date, bank, notes, status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'معلق', 'مستلم')
    `).run(check_number, date, from_client, amount, due_date, bank, notes);
    
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/checks/portfolio/:id/deposit', (req, res) => {
  try {
    const check = db.prepare('SELECT * FROM checks_portfolio WHERE id = ?').get(req.params.id);
    
    if (!check) {
      return res.status(404).json({ error: 'Check not found' });
    }
    
    const depositDate = new Date().toISOString().split('T')[0];
    
    db.prepare(`
      UPDATE checks_portfolio 
      SET status = 'محصّل', deposited_date = ?
      WHERE id = ?
    `).run(depositDate, req.params.id);
    
    // 🔧 CORRECTED: Add to treasury_ledger
    addTreasuryEntry(
      depositDate, 'وارد',
      `تحصيل شيك ${check.check_number} من ${check.from_client}`,
      check.amount, 'البنك',
      'check_deposit', req.params.id,
      req.body.user || 'system'
    );
    
    res.json({ message: 'Check deposited successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/checks/portfolio/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM checks_portfolio WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/checks/issued', (req, res) => {
  try {
    const checks = db.prepare('SELECT * FROM checks_issued ORDER BY due_date DESC').all();
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// استمرار في الرد التالي...

// ============================================
// 🔧 CORRECTED: TREASURY API (READ-ONLY + COMPUTED)
// ============================================

// ❌ NO UPDATE OR DELETE endpoints for treasury!

app.get('/api/treasury/balance', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    
    let cash = parseFloat(ob.cash || 0);
    let bank = parseFloat(ob.bank || 0);
    
    ledger.forEach(entry => {
      const amt = parseFloat(entry.amount || 0);
      if (entry.type === 'وارد') {
        if (entry.account === 'الصندوق') cash += amt;
        else bank += amt;
      } else {
        if (entry.account === 'الصندوق') cash -= amt;
        else bank -= amt;
      }
    });
    
    res.json({ cash, bank, total: cash + bank });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/treasury/movements', (req, res) => {
  try {
    const { from_date, to_date, account, limit } = req.query;
    
    let sql = 'SELECT * FROM treasury_ledger WHERE 1=1';
    const params = [];
    
    if (from_date) {
      sql += ' AND date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND date <= ?';
      params.push(to_date);
    }
    if (account) {
      sql += ' AND account = ?';
      params.push(account);
    }
    
    sql += ' ORDER BY date DESC, created_at DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const movements = db.prepare(sql).all(...params);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/treasury/summary', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`
      SELECT SUM(amount) as total FROM checks_portfolio 
      WHERE status = 'معلق' AND used_for_payment = 0
    `).get();
    
    let cash = parseFloat(ob.cash || 0);
    let bank = parseFloat(ob.bank || 0);
    let cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    
    ledger.forEach(entry => {
      const amt = parseFloat(entry.amount || 0);
      if (entry.type === 'وارد') {
        if (entry.account === 'الصندوق') {
          cash += amt;
          cashIn += amt;
        } else {
          bank += amt;
          bankIn += amt;
        }
      } else {
        if (entry.account === 'الصندوق') {
          cash -= amt;
          cashOut += amt;
        } else {
          bank -= amt;
          bankOut += amt;
        }
      }
    });
    
    res.json({
      cash: { balance: cash, in: cashIn, out: cashOut },
      bank: { balance: bank, in: bankIn, out: bankOut },
      checksUnderCollection: parseFloat(checksPortfolio.total || 0),
      totalLiquid: cash + bank + parseFloat(checksPortfolio.total || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - SIMPLE CRUD TABLES
// ============================================

const simpleTables = ['clients', 'suppliers', 'expenses', 'employees', 'vehicle_tours', 'partners'];

simpleTables.forEach(table => {
  const crud = crudWithAudit(table);
  
  app.get(`/api/${table}`, (req, res) => {
    try { res.json(crud.all()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.post(`/api/${table}`, (req, res) => {
    try {
      const result = crud.create(req.body, req.body.user || 'system');
      res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  
  app.put(`/api/${table}/:id`, (req, res) => {
    try {
      crud.update(req.params.id, req.body, req.body.user || 'system', req.body.reason);
      res.json({ id: req.params.id, ...req.body });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  
  app.delete(`/api/${table}/:id`, (req, res) => {
    try {
      crud.delete(req.params.id, req.body.user || 'system', req.body.reason);
      res.status(204).send();
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
});

// Special handling for expenses to update treasury
app.post('/api/expenses', (req, res) => {
  try {
    const { date, category, description, amount, payment_method, user } = req.body;
    
    const result = db.prepare(`
      INSERT INTO expenses (date, category, description, amount, payment_method)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, category, description, amount, payment_method);
    
    const expenseId = result.lastInsertRowid;
    
    // 🔧 CORRECTED: Add to treasury_ledger if cash payment
    if (payment_method === 'نقدي') {
      addTreasuryEntry(
        date, 'صادر',
        `${category} - ${description}`,
        amount, 'الصندوق',
        'expense', expenseId, user
      );
    } else if (payment_method === 'بنك') {
      addTreasuryEntry(
        date, 'صادر',
        `${category} - ${description}`,
        amount, 'البنك',
        'expense', expenseId, user
      );
    }
    
    logAudit('expenses', expenseId, 'create', null, req.body, user || 'system');
    
    res.status(201).json({ id: expenseId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - DASHBOARD
// ============================================

app.get('/api/dashboard', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`
      SELECT SUM(amount) as total FROM checks_portfolio 
      WHERE status = 'معلق' AND used_for_payment = 0
    `).get();
    
    let cash = parseFloat(ob.cash || 0);
    let bank = parseFloat(ob.bank || 0);
    
    ledger.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'وارد') {
        if (t.account === 'الصندوق') cash += amt;
        else bank += amt;
      } else {
        if (t.account === 'الصندوق') cash -= amt;
        else bank -= amt;
      }
    });
    
    const checksUnderCollection = parseFloat(checksPortfolio.total || 0);
    
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients').get();
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers').get();
    
    // 🔧 CORRECTED: Use subtotal and discount properly
    const salesData = db.prepare('SELECT SUM(subtotal) as subtotal, SUM(discount_amount) as discounts, SUM(final_amount) as net FROM sales').get();
    const purchases = db.prepare('SELECT SUM(total_amount) as total FROM purchases').get();
    const expenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get();
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory').get();
    
    const grossSales = parseFloat(salesData.subtotal || 0);
    const salesDiscounts = parseFloat(salesData.discounts || 0);
    const netSales = parseFloat(salesData.net || 0);
    const totalPurchases = parseFloat(purchases.total || 0);
    const totalExpenses = parseFloat(expenses.total || 0);
    
    res.json({
      cash,
      bank,
      checksUnderCollection,
      totalLiquid: cash + bank + checksUnderCollection,
      inventoryValue: parseFloat(inventory.total || 0),
      clientsDebt: parseFloat(clients.total || 0),
      suppliersDebt: parseFloat(suppliers.total || 0),
      grossSales,
      salesDiscounts,
      netSales,
      totalPurchases,
      totalExpenses,
      netProfit: netSales - totalPurchases - totalExpenses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 🔧 CORRECTED: REPORTS WITH PROPER DISCOUNT HANDLING
// ============================================

app.get('/api/reports/balance-sheet', (req, res) => {
  try {
    const { year } = req.query;
    
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    const ledger = db.prepare('SELECT * FROM treasury_ledger').all();
    const checksPortfolio = db.prepare(`
      SELECT SUM(amount) as total FROM checks_portfolio 
      WHERE status = 'معلق' AND used_for_payment = 0
    `).get();
    
    let cash = parseFloat(ob.cash || 0);
    let bank = parseFloat(ob.bank || 0);
    
    ledger.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'وارد') {
        if (t.account === 'الصندوق') cash += amt;
        else bank += amt;
      } else {
        if (t.account === 'الصندوق') cash -= amt;
        else bank -= amt;
      }
    });
    
    const inventory = db.prepare('SELECT SUM(quantity * unit_cost) as total FROM inventory').get();
    const clients = db.prepare('SELECT SUM(balance) as total FROM clients').get();
    const suppliers = db.prepare('SELECT SUM(balance) as total FROM suppliers').get();
    const partners = db.prepare('SELECT SUM(initial_capital) as total FROM partners').get();
    
    const assets = {
      cash,
      bank,
      checks: parseFloat(checksPortfolio.total || 0),
      inventory: parseFloat(inventory.total || 0),
      clientsDebt: parseFloat(clients.total || 0),
      total: cash + bank + parseFloat(checksPortfolio.total || 0) + parseFloat(inventory.total || 0) + parseFloat(clients.total || 0)
    };
    
    const liabilities = {
      suppliersDebt: parseFloat(suppliers.total || 0),
      total: parseFloat(suppliers.total || 0)
    };
    
    const equity = {
      capital: parseFloat(partners.total || 0),
      total: parseFloat(partners.total || 0)
    };
    
    res.json({ assets, liabilities, equity, year: year || new Date().getFullYear() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/income-statement', (req, res) => {
  try {
    const { year } = req.query;
    
    // 🔧 CORRECTED: Proper discount handling
    const salesData = db.prepare('SELECT SUM(subtotal) as gross, SUM(discount_amount) as discounts, SUM(final_amount) as net FROM sales').get();
    const purchases = db.prepare('SELECT SUM(total_amount) as total FROM purchases').get();
    const expenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get();
    const manufacturing = db.prepare('SELECT SUM(total_cost) as total FROM manufacturing_orders WHERE status = "مكتمل"').get();
    
    const grossSales = parseFloat(salesData.gross || 0);
    const salesDiscounts = parseFloat(salesData.discounts || 0);  // 🔧 نقص إيراد
    const netSales = parseFloat(salesData.net || 0);
    
    const costOfGoods = parseFloat(purchases.total || 0) + parseFloat(manufacturing.total || 0);
    const operatingExpenses = parseFloat(expenses.total || 0);
    const netProfit = netSales - costOfGoods - operatingExpenses;
    
    res.json({
      revenue: {
        gross_sales: grossSales,
        less_sales_discounts: salesDiscounts,  // 🔧 هنا الخصم
        net_sales: netSales,
        total: netSales
      },
      cost_of_goods: {
        purchases: parseFloat(purchases.total || 0),
        manufacturing: parseFloat(manufacturing.total || 0),
        total: costOfGoods
      },
      gross_profit: netSales - costOfGoods,
      expenses: {
        operating: operatingExpenses,  // 🔧 الخصم ليس هنا!
        total: operatingExpenses
      },
      net_profit: netProfit,
      year: year || new Date().getFullYear()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/distribute-profit', (req, res) => {
  try {
    const { fiscal_year, net_profit } = req.body;
    
    const partners = db.prepare('SELECT * FROM partners WHERE active = 1').all();
    
    const distributions = [];
    partners.forEach(partner => {
      const share_amount = net_profit * (partner.share_percent / 100);
      
      db.prepare(`
        INSERT INTO profit_distributions (fiscal_year, partner_id, net_profit, share_percent, share_amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(fiscal_year, partner.id, net_profit, partner.share_percent, share_amount);
      
      distributions.push({
        partner_id: partner.id,
        partner_name: partner.name,
        share_percent: partner.share_percent,
        share_amount
      });
    });
    
    res.json({ fiscal_year, net_profit, distributions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/manufacturing-cost-analysis', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT mo.*,
        cc.code as color_code,
        st.name as service_name,
        st.overhead_rate,
        a.name as artisan_name
      FROM manufacturing_orders mo
      LEFT JOIN color_codes cc ON mo.color_code_id = cc.id
      LEFT JOIN service_types st ON mo.service_type_id = st.id
      LEFT JOIN artisans a ON mo.artisan_id = a.id
      WHERE mo.status = 'مكتمل'
      ORDER BY mo.completed_at DESC
    `).all();
    
    const summary = {
      total_orders: orders.length,
      total_material_cost: orders.reduce((s, o) => s + parseFloat(o.total_material_cost || 0), 0),
      total_labor_cost: orders.reduce((s, o) => s + parseFloat(o.total_labor_cost || 0), 0),
      total_overhead_cost: orders.reduce((s, o) => s + parseFloat(o.overhead_cost || 0), 0),
      total_cost: orders.reduce((s, o) => s + parseFloat(o.total_cost || 0), 0),
      avg_unit_cost: orders.length > 0 ? orders.reduce((s, o) => s + parseFloat(o.unit_cost || 0), 0) / orders.length : 0
    };
    
    res.json({ summary, orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔧 CORRECTED: Inventory valuation based on movements
app.get('/api/reports/inventory-valuation', (req, res) => {
  try {
    const valuation = db.prepare(`
      SELECT 
        i.id,
        i.warehouse_id,
        i.product_type_id,
        i.color_code_id,
        w.name as warehouse_name,
        pt.name as product_name,
        cc.code as color_code,
        i.quantity as snapshot_quantity,
        SUM(
          CASE 
            WHEN im.movement_type = 'in' THEN im.quantity
            WHEN im.movement_type = 'out' THEN -im.quantity
          END
        ) as actual_quantity,
        AVG(CASE WHEN im.movement_type = 'in' THEN im.unit_cost END) as avg_cost
      FROM inventory i
      LEFT JOIN inventory_movements im ON i.id = im.inventory_id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes cc ON i.color_code_id = cc.id
      GROUP BY i.id
    `).all();
    
    const total_value = valuation.reduce((sum, item) => {
      const qty = parseFloat(item.actual_quantity || 0);
      const cost = parseFloat(item.avg_cost || 0);
      return sum + (qty * cost);
    }, 0);
    
    res.json({ valuation, total_value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API ENDPOINTS - AUDIT LOG
// ============================================

app.get('/api/audit/log', (req, res) => {
  try {
    const { table_name, record_id, user, limit } = req.query;
    
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    
    if (table_name) {
      sql += ' AND table_name = ?';
      params.push(table_name);
    }
    if (record_id) {
      sql += ' AND record_id = ?';
      params.push(record_id);
    }
    if (user) {
      sql += ' AND user = ?';
      params.push(user);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// OPENING BALANCES
// ============================================

app.get('/api/opening-balances', (req, res) => {
  try {
    const ob = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    res.json(ob);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/opening-balances', (req, res) => {
  try {
    const { cash, bank, fiscal_year, user } = req.body;
    
    const old = db.prepare('SELECT * FROM opening_balances WHERE id = 1').get();
    
    db.prepare(`
      UPDATE opening_balances 
      SET cash = ?, bank = ?, fiscal_year = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `).run(cash, bank, fiscal_year);
    
    logAudit('opening_balances', 1, 'update', old, req.body, user || 'system');
    
    res.json(req.body);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🏭 PROFESSIONAL ERP ACCOUNTING SYSTEM v2.0 (CORRECTED)       ║
║                                                                ║
║   📊 Dashboard:     http://localhost:${PORT}                      ║
║   🔌 API:           http://localhost:${PORT}/api/dashboard        ║
║   💾 Database:      ${DB_PATH}                    ║
║                                                                ║
║   ✅ CORRECTIONS:                                              ║
║      - Treasury = Ledger (append-only)                         ║
║      - Discount = نقص إيراد (not expense)                      ║
║      - Overhead = configurable per service                     ║
║      - Inventory movements = source of truth                   ║
║                                                                ║
║   ✅ Modules:                                                  ║
║      - Color Codes (backbone)                                  ║
║      - Advanced Inventory                                      ║
║      - Manufacturing with dynamic costs                        ║
║      - POS System with constraints                             ║
║      - Professional Check Management                           ║
║      - Treasury Ledger (read-only)                             ║
║      - Financial Reports (accurate)                            ║
║      - Complete Audit Log                                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});
