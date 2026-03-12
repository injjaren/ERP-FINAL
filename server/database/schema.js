'use strict';

const schema = `
-- Core entities
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  branch_id INTEGER,
  balance REAL DEFAULT 0,
  allow_credit INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  branch_id INTEGER,
  balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
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
  branch_id INTEGER,
  inventory_stage TEXT CHECK(inventory_stage IN ('raw_bobbin','wholesale_kg','retail_kg','retail_oz','supplies')),
  active INTEGER DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
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
  master_color_id INTEGER,
  inventory_stage TEXT NOT NULL DEFAULT 'wholesale_kg'
    CHECK(inventory_stage IN ('raw_bobbin','wholesale_kg','retail_kg','retail_oz','supplies')),
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  min_quantity REAL DEFAULT 0,
  opening_balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  FOREIGN KEY (color_code_id) REFERENCES color_codes(id),
  FOREIGN KEY (master_color_id) REFERENCES master_colors(id)
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

-- ARTISAN SERVICE RATES (time-versioned, append-only)
CREATE TABLE IF NOT EXISTS artisan_service_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id INTEGER NOT NULL,
  service_type_id INTEGER NOT NULL,
  rate REAL NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(artisan_id) REFERENCES artisans(id),
  FOREIGN KEY(service_type_id) REFERENCES service_types(id),
  UNIQUE(artisan_id, service_type_id, effective_from)
);

-- INVOICE REVISION SYSTEM
CREATE TABLE IF NOT EXISTS invoice_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  created_by TEXT,
  FOREIGN KEY(invoice_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS invoice_revision_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id INTEGER NOT NULL,
  service_type_id INTEGER,
  quantity REAL,
  unit_price REAL,
  artisan_id INTEGER,
  status TEXT DEFAULT 'Draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(revision_id) REFERENCES invoice_revisions(id),
  FOREIGN KEY(service_type_id) REFERENCES service_types(id),
  FOREIGN KEY(artisan_id) REFERENCES artisans(id)
  -- Uniqueness enforced via idx_unique_revision_item index below (COALESCE not allowed in table UNIQUE)
);

-- ── SALE ITEMS v5 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL,
  product_id  INTEGER NOT NULL,
  branch_id   INTEGER NOT NULL,
  quantity    REAL    NOT NULL,
  sell_price  REAL    NOT NULL,
  unit_cost   REAL    NOT NULL,
  total_price REAL    NOT NULL,
  total_cost  REAL    NOT NULL,
  company_id  INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

-- ── MASTER COLOR CATALOG v6 ──────────────────────────────────────────────────
-- Global catalog: one canonical entry per (color_code, company_id).
-- Only branch "الجملة" may INSERT; all others are READ-ONLY.
CREATE TABLE IF NOT EXISTS master_colors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  color_code   TEXT    NOT NULL,
  color_family TEXT    NOT NULL,
  shade_name   TEXT    NOT NULL,
  hex_code     TEXT,
  is_active    INTEGER DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_id   INTEGER NOT NULL DEFAULT 1
);

-- ── BRANCH TRANSFERS v7 ──────────────────────────────────────────────────────
-- Internal commercial transaction between branches.
-- NOT a simple stock move: creates accounting receivable/payable per branch.
CREATE TABLE IF NOT EXISTS branch_transfers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_branch_id  INTEGER NOT NULL,
  to_branch_id    INTEGER NOT NULL,
  transfer_number TEXT    NOT NULL,
  transfer_date   DATE    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'confirmed',
  total_amount    REAL    NOT NULL,
  to_warehouse_id INTEGER,
  created_by      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_id      INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  FOREIGN KEY (to_branch_id)   REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS branch_transfer_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id  INTEGER NOT NULL,
  inventory_id INTEGER NOT NULL,
  quantity     REAL    NOT NULL,
  unit_price   REAL    NOT NULL,
  total_price  REAL    NOT NULL,
  company_id   INTEGER NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transfer_id)  REFERENCES branch_transfers(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

-- ── ERP-v8: MANUFACTURING ENGINE ─────────────────────────────────────────────
-- production_batches: one batch = one production run in الجملة branch
CREATE TABLE IF NOT EXISTS production_batches (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_code           TEXT    NOT NULL,
  branch_id            INTEGER NOT NULL,
  total_produced_kg    REAL    NOT NULL DEFAULT 0,
  direct_material_cost REAL    NOT NULL DEFAULT 0,
  direct_labor_cost    REAL    NOT NULL DEFAULT 0,
  jaab_cost            REAL    NOT NULL DEFAULT 0,
  total_direct_cost    REAL    NOT NULL DEFAULT 0,
  overhead_allocated   REAL    NOT NULL DEFAULT 0,
  full_cost            REAL    NOT NULL DEFAULT 0,
  status               TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at            DATETIME,
  company_id           INTEGER NOT NULL DEFAULT 1,
  UNIQUE(batch_code, company_id)
);

-- production_entries: one entry = one artisan's work record within a batch
CREATE TABLE IF NOT EXISTS production_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id          INTEGER NOT NULL,
  artisan_id        INTEGER,
  produced_kg       REAL    NOT NULL,
  labor_rate_per_kg REAL    NOT NULL DEFAULT 0,
  labor_cost        REAL    NOT NULL DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_id        INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id)
);

-- production_material_usage: raw materials consumed per batch
CREATE TABLE IF NOT EXISTS production_material_usage (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id              INTEGER NOT NULL,
  material_inventory_id INTEGER NOT NULL,
  quantity_used         REAL    NOT NULL,
  cost_used             REAL    NOT NULL DEFAULT 0,
  company_id            INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (batch_id)              REFERENCES production_batches(id),
  FOREIGN KEY (material_inventory_id) REFERENCES inventory(id)
);

-- ── COLOR SYSTEM v9 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS color_families (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  family_name_ar  TEXT    NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  company_id      INTEGER NOT NULL DEFAULT 1
);

-- ── CANONICAL COLORS v11 ─────────────────────────────────────────────────────
-- Middle tier: color_families → colors → color_codes / color_master
CREATE TABLE IF NOT EXISTS colors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES color_families(id),
  name_ar    TEXT    NOT NULL,
  hex_code   TEXT,
  company_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS color_master (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id          INTEGER,
  supplier_color_code  TEXT    NOT NULL,
  internal_ar_name     TEXT    NOT NULL,
  shade_note           TEXT,
  family_id            INTEGER,
  hex_code             TEXT,
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_id           INTEGER NOT NULL DEFAULT 1,
  UNIQUE(supplier_id, supplier_color_code, company_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (family_id)   REFERENCES color_families(id)
);

-- ── MANUFACTURING SESSION ENGINE v9 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artisan_rates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  artisan_id           INTEGER NOT NULL,
  rate_per_combination REAL    NOT NULL DEFAULT 0,
  rate_per_kg          REAL    NOT NULL DEFAULT 0,
  company_id           INTEGER NOT NULL DEFAULT 1,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artisan_id, company_id)
);

CREATE TABLE IF NOT EXISTS production_sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date          DATE    NOT NULL,
  artisan_id            INTEGER NOT NULL,
  branch_id             INTEGER NOT NULL,
  status                TEXT    NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','CANCELLED')),
  total_combinations    INTEGER NOT NULL DEFAULT 0,
  total_kg_produced     REAL    NOT NULL DEFAULT 0,
  calculated_labor_cost REAL    NOT NULL DEFAULT 0,
  final_labor_cost      REAL    NOT NULL DEFAULT 0,
  labor_modified        INTEGER NOT NULL DEFAULT 0,
  closed_at             DATETIME,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  company_id            INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (branch_id)  REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS production_lines (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                INTEGER NOT NULL,
  color_id                  INTEGER NOT NULL,
  combinations              INTEGER NOT NULL DEFAULT 0,
  bobbins_consumed          INTEGER NOT NULL DEFAULT 0,
  actual_kg_produced        REAL    NOT NULL DEFAULT 0,
  prior_produced_kg         REAL    NOT NULL DEFAULT 0,
  rate_per_kg               REAL    NOT NULL DEFAULT 6,
  line_status               TEXT    NOT NULL DEFAULT 'in_progress',
  notes                     TEXT,
  transferred_to_session_id INTEGER,
  transferred_from_line_id  INTEGER,
  company_id                INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (session_id) REFERENCES production_sessions(id),
  FOREIGN KEY (color_id)   REFERENCES color_master(id)
);

-- ── MULTI-COMPANY FOUNDATION v4 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  status     TEXT    DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('ADMIN','STAFF','owner','OWNER')),
  company_id    INTEGER NOT NULL,
  status        TEXT    DEFAULT 'active',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(company_id) REFERENCES companies(id)
);

-- ── PHASE 6: WORKER TRANSACTIONS ─────────────────────────────────────────────
-- Records per-session earnings, advances, and deductions for artisans/workers.
-- amount = kg × rate for earning type.
CREATE TABLE IF NOT EXISTS worker_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id      INTEGER NOT NULL,
  session_id     INTEGER,
  type           TEXT    NOT NULL DEFAULT 'earning'
                   CHECK(type IN ('earning','advance','deduction')),
  kg             REAL    NOT NULL DEFAULT 0,
  rate           REAL    NOT NULL DEFAULT 0,
  amount         REAL    NOT NULL,
  description    TEXT,
  reference_type TEXT,
  reference_id   INTEGER,
  company_id     INTEGER NOT NULL DEFAULT 1,
  branch_id      INTEGER,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id)  REFERENCES artisans(id),
  FOREIGN KEY (session_id) REFERENCES production_sessions(id)
);

-- PROMISSORY NOTES (TRAITES)
-- Documented in docs/WHOLESALE_SYSTEM.md
-- Represents future payment commitments from customers.
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
);

-- ── POS_TAILORING MODULE ──────────────────────────────────────────────────────
-- Implements the Retail Tailoring flow from docs/01_BUSINESS_MODEL.md
-- Hierarchy: tailoring_orders → tailoring_garments → tailoring_services
-- Materials per garment tracked in garment_materials; consumed on garment completion.

CREATE TABLE IF NOT EXISTS tailoring_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT    NOT NULL,
  company_id   INTEGER NOT NULL DEFAULT 1,
  branch_id    INTEGER NOT NULL,
  client_id    INTEGER REFERENCES clients(id),
  client_name  TEXT,
  client_phone TEXT,
  order_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT    NOT NULL DEFAULT 'NEW'
                 CHECK(status IN ('NEW','IN_PRODUCTION','PARTIAL_READY','READY','DELIVERED','CANCELLED')),
  total_price  REAL    NOT NULL DEFAULT 0,
  deposit_paid REAL    NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_number, company_id)
);

CREATE TABLE IF NOT EXISTS tailoring_garments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES tailoring_orders(id),
  company_id   INTEGER NOT NULL DEFAULT 1,
  garment_type TEXT    NOT NULL,
  color_id     INTEGER REFERENCES color_master(id),
  color_desc   TEXT,
  quantity     INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  status       TEXT    NOT NULL DEFAULT 'PENDING'
                 CHECK(status IN ('PENDING','IN_PRODUCTION','READY','DELIVERED')),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tailoring_services (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id   INTEGER NOT NULL REFERENCES tailoring_garments(id),
  company_id   INTEGER NOT NULL DEFAULT 1,
  service_type TEXT    NOT NULL,
  quantity     REAL    NOT NULL DEFAULT 1,
  unit         TEXT    NOT NULL DEFAULT 'unit',
  price        REAL    NOT NULL DEFAULT 0,
  artisan_id   INTEGER REFERENCES artisans(id),
  status       TEXT    NOT NULL DEFAULT 'ASSIGNED'
                 CHECK(status IN ('ASSIGNED','IN_PROGRESS','DONE')),
  notes        TEXT,
  assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  done_at      DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS garment_materials (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id   INTEGER NOT NULL REFERENCES tailoring_garments(id),
  company_id   INTEGER NOT NULL DEFAULT 1,
  warehouse_id INTEGER REFERENCES warehouses(id),
  product_type_id INTEGER REFERENCES product_types(id),
  color_id     INTEGER REFERENCES color_master(id),
  product_name TEXT,
  quantity     REAL    NOT NULL,
  unit         TEXT    NOT NULL DEFAULT 'unit',
  consumed     INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service catalog: master list of available tailoring services per company
CREATE TABLE IF NOT EXISTS service_catalog (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   INTEGER NOT NULL DEFAULT 1,
  name         TEXT    NOT NULL,
  name_ar      TEXT,
  unit         TEXT    NOT NULL DEFAULT 'unit',
  base_price   REAL    NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name)
);

-- Seed catalog with default Moroccan tailoring services
INSERT OR IGNORE INTO service_catalog (company_id, name, name_ar, unit, base_price)
VALUES
  (1, 'Sfifa',   'سفيفة',  'meter', 0),
  (1, 'Akaad',   'عقاد',   'unit',  0),
  (1, 'Mraim',   'مرايم',  'unit',  0),
  (1, 'Trassan', 'تراسان', 'unit',  0);
`;

module.exports = { schema };
