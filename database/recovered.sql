.dbconfig defensive off
BEGIN;
PRAGMA writable_schema = on;
PRAGMA foreign_keys = off;
PRAGMA encoding = 'UTF-8';
PRAGMA page_size = '4096';
PRAGMA auto_vacuum = '0';
PRAGMA user_version = '0';
PRAGMA application_id = '0';
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0,
  allow_credit INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE color_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  main_color TEXT NOT NULL,
  shade TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE product_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE inventory (
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
CREATE TABLE inventory_movements (
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
CREATE TABLE artisans (
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
, artisan_type TEXT DEFAULT 'SERVICE');
CREATE TABLE service_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  overhead_rate REAL DEFAULT 0.10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE artisan_services (
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
CREATE TABLE manufacturing_orders (
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
CREATE TABLE manufacturing_inputs (
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
CREATE TABLE manufacturing_outputs (
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
CREATE TABLE tdwar_color_combinations (
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
CREATE TABLE production_bags (
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
CREATE TABLE production_entries (
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
CREATE TABLE artisan_accounts (
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
CREATE TABLE sales (
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, invoice_status TEXT DEFAULT 'Completed', deposit_amount REAL DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE TABLE sales_items (
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
CREATE TABLE sales_payments (
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
CREATE TABLE special_orders (
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
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  supplier_id INTEGER,
  supplier_name TEXT,
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'OPEN', applied_credit REAL DEFAULT 0,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
CREATE TABLE purchases_items (
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
CREATE TABLE purchases_payments (
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
CREATE TABLE checks_portfolio (
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
CREATE TABLE checks_issued (
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
CREATE TABLE treasury_ledger (
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
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  salary REAL NOT NULL,
  phone TEXT,
  hire_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vehicle_tours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  city TEXT NOT NULL,
  sales REAL NOT NULL,
  expenses REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE opening_balances (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cash REAL DEFAULT 0,
  bank REAL DEFAULT 0,
  fiscal_year INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE audit_log (
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
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  share_percent REAL NOT NULL,
  initial_capital REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE profit_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER NOT NULL,
  partner_id INTEGER NOT NULL,
  net_profit REAL NOT NULL,
  share_percent REAL NOT NULL,
  share_amount REAL NOT NULL,
  distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
);
CREATE TABLE artisan_service_rates (
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
CREATE TABLE invoice_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  created_by TEXT,
  FOREIGN KEY(invoice_id) REFERENCES sales(id)
);
CREATE TABLE invoice_revision_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id INTEGER NOT NULL,
  service_type_id INTEGER,
  quantity REAL,
  unit_price REAL,
  artisan_id INTEGER,
  status TEXT DEFAULT 'Draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, artisan_rate REAL DEFAULT 0,
  FOREIGN KEY(revision_id) REFERENCES invoice_revisions(id),
  FOREIGN KEY(service_type_id) REFERENCES service_types(id),
  FOREIGN KEY(artisan_id) REFERENCES artisans(id)
  -- Uniqueness enforced via idx_unique_revision_item index below (COALESCE not allowed in table UNIQUE)
);
CREATE UNIQUE INDEX idx_unique_revision_item
    ON invoice_revision_items (
      revision_id,
      IFNULL(service_type_id, 0),
      IFNULL(artisan_id, 0)
    )
  ;
CREATE UNIQUE INDEX idx_inventory_unique ON inventory(warehouse_id, product_type_id, COALESCE(color_code_id, 0));
INSERT OR IGNORE INTO 'clients'('id', 'code', 'name', 'phone', 'address', 'balance', 'allow_credit', 'created_at') VALUES (1, 'CLI1000', 'عبد الرحمان لامين', '064525848', 'تيزنيت', 0, 1, '2026-02-21 15:58:18');
INSERT OR IGNORE INTO 'clients'('id', 'code', 'name', 'phone', 'address', 'balance', 'allow_credit', 'created_at') VALUES (2, 'CLI1001', 'خرخاش حسن', '06254825', 'انزكان', 65, 1, '2026-02-21 15:58:46');
INSERT OR IGNORE INTO 'suppliers'('id', 'code', 'name', 'phone', 'address', 'balance', 'created_at') VALUES (1, 'SUP2000', 'الجامعي حسن', '06612525485', 'فاس', 0, '2026-02-21 15:57:25');
INSERT OR IGNORE INTO 'suppliers'('id', 'code', 'name', 'phone', 'address', 'balance', 'created_at') VALUES (2, 'SUP2001', 'بنيس المهدي', '0661254258', 'فاس', 0, '2026-02-21 15:57:46');
INSERT OR IGNORE INTO 'suppliers'('id', 'code', 'name', 'phone', 'address', 'balance', 'created_at') VALUES (3, 'SUP2002', 'Jamaa Injjaren', '', 'rue idaoutanan no 80 inezgane', 0, '2026-02-22 01:51:14');
INSERT OR IGNORE INTO 'color_codes'('id', 'code', 'main_color', 'shade', 'description', 'active', 'created_at') VALUES (1, 'MF3001', 'باج', 'باج ', NULL, 1, '2026-02-21 16:05:30');
INSERT OR IGNORE INTO 'warehouses'('id', 'code', 'name', 'location', 'active', 'created_at') VALUES (1, 'WH4000', 'Grofil', 'أسايس', 1, '2026-02-21 16:02:04');
INSERT OR IGNORE INTO 'product_types'('id', 'code', 'name', 'category', 'unit', 'created_at') VALUES (1, 'PRD5000', 'بوبين ', 'مواد_خام', 'كيلو', '2026-02-21 15:59:45');
INSERT OR IGNORE INTO 'product_types'('id', 'code', 'name', 'category', 'unit', 'created_at') VALUES (2, 'PRD5001', 'صابرة', 'منتجات_نهائية', 'كيلو', '2026-02-21 16:00:05');
INSERT OR IGNORE INTO 'product_types'('id', 'code', 'name', 'category', 'unit', 'created_at') VALUES (3, 'PRD5002', 'جعاب', 'مواد_خام', 'خنشة', '2026-02-21 16:00:18');
INSERT OR IGNORE INTO 'inventory'('id', 'warehouse_id', 'product_type_id', 'color_code_id', 'color_description', 'quantity', 'unit_cost', 'unit_price', 'min_quantity', 'opening_balance', 'created_at') VALUES (8, 1, 1, 1, NULL, 24, 78, 95, 0, 0, '2026-02-23 17:32:22');
INSERT OR IGNORE INTO 'service_types'('id', 'code', 'name', 'description', 'overhead_rate', 'created_at') VALUES (1, 'SRV6000', 'التدوار', '', 0.1, '2026-02-21 16:01:13');
INSERT OR IGNORE INTO 'service_types'('id', 'code', 'name', 'description', 'overhead_rate', 'created_at') VALUES (2, 'SRV6001', 'سفيفة', '', 0.1, '2026-02-21 16:01:26');
INSERT OR IGNORE INTO 'sales'('id', 'invoice_number', 'date', 'client_id', 'client_name', 'client_phone', 'subtotal', 'discount_percent', 'discount_amount', 'final_amount', 'status', 'notes', 'created_by', 'created_at', 'invoice_status', 'deposit_amount') VALUES (1, 'SAL1771866324282', '2026-02-23', 2, 'خرخاش حسن', '06254825', 165, 0, 0, 165, 'completed', NULL, 'admin', '2026-02-23 17:05:24', 'Completed', 0);
INSERT OR IGNORE INTO 'sales_items'('id', 'sale_id', 'inventory_id', 'product_name', 'color_code_id', 'quantity', 'unit_price', 'total_price', 'is_special_order', 'special_order_id', 'created_at') VALUES (1, 1, 7, 'صابرة', 1, 3, 55, 165, 0, NULL, '2026-02-23 17:05:24');
INSERT OR IGNORE INTO 'sales_payments'('id', 'sale_id', 'payment_type', 'amount', 'check_number', 'check_date', 'check_due_date', 'bank', 'created_at') VALUES (1, 1, 'نقدي', 100, NULL, NULL, NULL, NULL, '2026-02-23 17:05:24');
INSERT OR IGNORE INTO 'sales_payments'('id', 'sale_id', 'payment_type', 'amount', 'check_number', 'check_date', 'check_due_date', 'bank', 'created_at') VALUES (2, 1, 'آجل', 65, NULL, NULL, NULL, NULL, '2026-02-23 17:05:24');
INSERT OR IGNORE INTO 'purchases'('id', 'invoice_number', 'date', 'supplier_id', 'supplier_name', 'total_amount', 'notes', 'created_at', 'status', 'applied_credit') VALUES (1, 'PUR-DEMO-001', '2026-02-22', 1, '������� ���', 500, 'demo', '2026-02-22 01:39:44', 'OPEN', 0);
INSERT OR IGNORE INTO 'purchases'('id', 'invoice_number', 'date', 'supplier_id', 'supplier_name', 'total_amount', 'notes', 'created_at', 'status', 'applied_credit') VALUES (2, 'PUR1771726610546', '2026-02-22', NULL, '', 625, NULL, '2026-02-22 02:17:16', 'OPEN', 0);
INSERT OR IGNORE INTO 'purchases'('id', 'invoice_number', 'date', 'supplier_id', 'supplier_name', 'total_amount', 'notes', 'created_at', 'status', 'applied_credit') VALUES (3, 'PUR1771726775651', '2026-02-22', 2, 'بنيس المهدي', 5000, NULL, '2026-02-22 02:20:12', 'OPEN', 0);
INSERT OR IGNORE INTO 'purchases'('id', 'invoice_number', 'date', 'supplier_id', 'supplier_name', 'total_amount', 'notes', 'created_at', 'status', 'applied_credit') VALUES (4, 'PUR1771726849090', '2026-02-22', 1, 'الجامعي حسن', 5500, NULL, '2026-02-22 02:21:43', 'OPEN', 0);
INSERT OR IGNORE INTO 'purchases_payments'('id', 'purchase_id', 'payment_type', 'amount', 'check_number', 'check_date', 'check_due_date', 'bank', 'source_check_id', 'created_at') VALUES (1, 1, '����', 200, NULL, NULL, NULL, NULL, NULL, '2026-02-22 01:39:44');
INSERT OR IGNORE INTO 'treasury_ledger'('id', 'date', 'type', 'description', 'amount', 'account', 'reference_type', 'reference_id', 'created_by', 'created_at') VALUES (1, '2026-02-23', 'وارد', 'مبيعات - فاتورة SAL1771866324282', 100, 'الصندوق', 'sale', 1, 'admin', '2026-02-23 17:05:24');
INSERT OR IGNORE INTO 'opening_balances'('id', 'cash', 'bank', 'fiscal_year', 'updated_at') VALUES (1, 0, 0, 2026, '2026-02-21 00:24:09');
DELETE FROM sqlite_sequence;
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (1, 'artisan_service_rates', 0);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (2, 'suppliers', 3);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (3, 'audit_log', 25);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (4, 'clients', 2);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (5, 'product_types', 8);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (6, 'service_types', 2);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (7, 'warehouses', 3);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (8, 'color_codes', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (9, 'inventory', 8);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (10, 'purchases', 4);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (11, 'purchases_items', 4);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (12, 'inventory_movements', 5);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (13, 'purchases_payments', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (14, 'sales', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (15, 'sales_items', 1);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (16, 'sales_payments', 2);
INSERT OR IGNORE INTO 'sqlite_sequence'(_rowid_, 'name', 'seq') VALUES (17, 'treasury_ledger', 1);
PRAGMA writable_schema = off;
COMMIT;
