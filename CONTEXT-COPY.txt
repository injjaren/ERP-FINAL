# CONTEXT.md — ERP-FINAL: الوضع الحقيقي للمشروع

> تاريخ الاستخراج: 2026-03-04
> مُولَّد بقراءة الكود المصدري الفعلي — وليس CLAUDE.md

---

## 1. هيكل الملفات والمجلدات

```
ERP-FINAL/
├── server.js              # السيرفر الفعّال — 3,903 سطر (ليس 787 كما يقول CLAUDE.md)
├── server-base.js         # نسخة مرجعية قديمة — 2,004 سطر — غير فعّالة
├── apply-fixes.js         # أداة ترحيل — غير فعّالة حالياً
├── package.json           # الإصدار 3.0.0
├── CLAUDE.md              # ⚠️ معلوماته قديمة جداً (تقول server.js = 787 سطر)
├── FIXES-GUIDE.md         # دليل الإصلاحات
├── README.txt
├── START.bat              # تشغيل Windows
├── Dockerfile
├── docker-compose.yml
├── .gitignore
├── public/
│   ├── index.html         # SPA الرئيسية — 129 سطر
│   ├── app.js             # منطق الـ frontend — 3,396 سطر
│   └── styles.css         # تنسيق RTL عربي — 256 سطر
└── database/
    └── accounting.db      # قاعدة البيانات SQLite (تُنشأ تلقائياً)
```

**ملاحظة:** لا توجد مجلدات `logs/` أو `backups/` في المستودع — تُنشأ تلقائياً عند التشغيل.

---

## 2. هيكل قاعدة البيانات — كل الجداول والأعمدة

### 2.1 البيانات الأساسية

```sql
clients (id, code, name, phone, address, balance, allow_credit, created_at)
  -- balance = ديون العملاء (تُحدَّث عند الدفع الآجل)
  -- allow_credit = 1/0 للسماح بالدين

suppliers (id, code, name, phone, address, balance, created_at)
  -- ⚠️ balance موجود لكن لا يُحدَّث تلقائياً (انظر المشاكل)

color_codes (id, code, main_color, shade, description, active, created_at)
  -- العمود الأساسي هو: code, main_color, shade
  -- ⚠️ لا يوجد عمود name_ar (خطأ في الكود)

warehouses (id, code, name, location, active, created_at)

product_types (id, code, name, category, unit, created_at)

employees (id, code, name, position, salary, phone, hire_date, created_at)

partners (id, code, name, share_percent, initial_capital, active, created_at)
```

### 2.2 المخزون

```sql
inventory (
  id, warehouse_id, product_type_id, color_code_id, color_description,
  quantity, unit_cost, unit_price, min_quantity, opening_balance, created_at
)
-- UNIQUE INDEX على (warehouse_id, product_type_id, COALESCE(color_code_id, 0))

inventory_movements (
  id, inventory_id, movement_type, quantity, unit_cost,
  reference_type, reference_id, notes, created_by, created_at
)
-- movement_type: 'in' | 'out'
```

### 2.3 الصناع والتصنيع

```sql
artisans (
  id, code, name, phone, address, craft_type,
  daily_expense, weekly_expense, account_balance, active,
  artisan_type,  -- ← أُضيف بمايغريشن (SERVICE | SABRA_PACKING)
  created_at
)

service_types (id, code, name, description, overhead_rate, created_at)

artisan_services (
  id, artisan_id, service_type_id, rate, rate_unit, created_at
  -- UNIQUE(artisan_id, service_type_id)
)

artisan_service_rates (
  id, artisan_id, service_type_id, rate, effective_from, created_at
  -- جدول مُعدَّل بالتاريخ — append-only
  -- UNIQUE(artisan_id, service_type_id, effective_from)
)

artisan_accounts (
  id, artisan_id, date, type, amount, description,
  reference_type, reference_id, created_at
)
-- type: 'debit' (مكسب للصانع) | 'credit' (دفعة من الصانع)

manufacturing_orders (
  id, order_number, date, service_type_id, artisan_id,
  labor_cost_per_unit, status, total_material_cost, total_labor_cost,
  overhead_cost, total_cost,
  number_of_compositions, bobbins_used, total_produced_kg,
  number_of_bags, avg_kg_per_bag,
  notes, started_at, completed_at, created_at
)
-- ⚠️ لا يوجد عمود color_code_id (خطأ في تقرير التكاليف)
-- status: 'قيد_التحضير' | 'قيد_الإنتاج' | 'مكتمل'

manufacturing_inputs (
  id, manufacturing_order_id, inventory_id, quantity_used,
  expected_output_quantity, actual_output_quantity, unit_cost, total_cost,
  waste_quantity, extraction_rate, status, created_at
)

manufacturing_outputs (
  id, manufacturing_order_id, manufacturing_input_id,
  output_inventory_id, quantity, unit_cost, created_at
)

tdwar_color_combinations (
  id, manufacturing_order_id, bobine_inventory_id, color_code_id,
  number_of_compositions, bobbins_used, total_produced_kg,
  expected_output_kg, status, created_at
)

production_bags (
  id, manufacturing_order_id, artisan_id, jaab_inventory_id, color_code_id,
  date_given, date_returned, status, expected_output_kg, total_produced_kg,
  waste_kg, yield_classification, closed_by_next_bag, notes, created_at
)
-- status: 'مفتوحة' | 'مغلقة'
-- yield_classification: 'OK' | 'ضعيف' | 'هدر'

production_entries (
  id, manufacturing_order_id, production_bag_id, artisan_id, date,
  quantity_kg, output_inventory_id, color_code_id,
  unit_price, artisan_amount, notes, created_at
)
```

### 2.4 المبيعات والمشتريات

```sql
sales (
  id, invoice_number, date, client_id, client_name, client_phone,
  subtotal, discount_percent, discount_amount, final_amount,
  status, notes, created_by,
  invoice_status,   -- ← أُضيف بمايغريشن (Draft|Confirmed|Sent_To_Artisan|In_Progress|Completed|Delivered|Closed)
  deposit_amount,   -- ← أُضيف بمايغريشن (مجموع العرابين)
  created_at
)
-- status: 'completed' | 'credit_note' | 'adjustment'

sales_items (
  id, sale_id, inventory_id, product_name, color_code_id,
  quantity, unit_price, total_price,
  is_special_order, special_order_id, created_at
)

sales_payments (
  id, sale_id, payment_type, amount,
  check_number, check_date, check_due_date, bank, created_at
)
-- payment_type: 'نقدي' | 'شيك' | 'تحويل' | 'TPE' | 'آجل' | 'أرابون'

special_orders (
  id, order_number, sale_id, date, client_id, client_name, client_phone,
  color_code_id, temp_color_description, service_type_id,
  quantity, unit_price, total_price, status,
  manufacturing_order_id, notes, created_at
)
-- status: 'قيد_التحضير' | 'قيد_الإنتاج' | 'مكتمل'

purchases (id, invoice_number, date, supplier_id, supplier_name, total_amount, notes, created_at)

purchases_items (id, purchase_id, inventory_id, quantity, unit_cost, total_cost, created_at)

purchases_payments (
  id, purchase_id, payment_type, amount,
  check_number, check_date, check_due_date, bank, source_check_id, created_at
)
-- payment_type: 'نقدي' | 'شيك' | 'شيك_مظهر' | 'آجل'
```

### 2.5 الشيكات والخزينة

```sql
checks_portfolio (
  id, check_number, date, from_client, amount, due_date, bank,
  status, source, used_for_payment, deposited_date,
  endorsed_to, endorsed_date, notes, created_at
)
-- status: 'معلق' | 'محصّل' | 'مظهّر'
-- source: 'مستلم' | 'مبيعات' | 'عربون'

checks_issued (
  id, check_number, date, received_date, check_owner, to_supplier,
  amount, due_date, bank, status, type, source_check_id, paid_date,
  notes, created_at
)
-- status: 'معلق' | 'مدفوع'
-- type: 'شيكاتي' | 'مظهّر'

treasury_ledger (
  id, date, type, description, amount, account,
  reference_type, reference_id, created_by, created_at
)
-- READ-ONLY (append-only) — لا تُعدَّل إطلاقاً
-- type: 'وارد' | 'صادر'
-- account: 'الصندوق' | 'البنك'

opening_balances (id, cash, bank, fiscal_year, updated_at)
-- صف واحد فقط id=1
```

### 2.6 المالية والنظام

```sql
expenses (id, date, category, description, amount, payment_method, created_at)
-- payment_method: 'نقدي' | 'بنك'

vehicle_tours (id, date, city, sales, expenses, notes, created_at)

profit_distributions (
  id, fiscal_year, partner_id, net_profit, share_percent, share_amount, distributed_at
)

audit_log (
  id, table_name, record_id, action, old_values, new_values,
  user, reason, ip_address, created_at
)

invoice_revisions (
  id, invoice_id, revision_number, created_at, reason, created_by
)

invoice_revision_items (
  id, revision_id, service_type_id, quantity, unit_price, artisan_id,
  artisan_rate,  -- ← أُضيف بمايغريشن (التكلفة المُجمَّدة لحظة الإنشاء)
  status, notes, created_at
)
-- UNIQUE INDEX على (revision_id, IFNULL(service_type_id,0), IFNULL(artisan_id,0))
-- status: 'Draft' | 'Completed'
```

---

## 3. كل الـ Endpoints الموجودة فعلاً

### 3.1 نظام

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/health` | حالة السيرفر |
| GET | `/api/dashboard` | KPIs الرئيسية |

### 3.2 الإعدادات الأساسية

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/color-codes` | جلب أكواد الألوان |
| POST | `/api/color-codes` | إنشاء كود لون |
| PUT | `/api/color-codes/:id` | تحديث كود لون |
| DELETE | `/api/color-codes/:id` | حذف كود لون |
| GET | `/api/warehouses` | جلب المخازن |
| POST | `/api/warehouses` | إنشاء مخزن |
| DELETE | `/api/warehouses/:id` | حذف مخزن |
| GET | `/api/product-types` | جلب أنواع المنتجات |
| POST | `/api/product-types` | إنشاء نوع منتج |
| DELETE | `/api/product-types/:id` | حذف نوع منتج |
| GET | `/api/service-types` | جلب أنواع الخدمات |
| POST | `/api/service-types` | إنشاء نوع خدمة |
| PUT | `/api/service-types/:id` | تحديث نوع خدمة |
| DELETE | `/api/service-types/:id` | حذف نوع خدمة |

### 3.3 المخزون

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/inventory` | جلب المخزون (مع joins) |
| POST | `/api/inventory` | إضافة/دمج صنف مخزون |
| POST | `/api/inventory/movement` | حركة مخزون يدوية |
| GET | `/api/inventory/:id/movements` | سجل حركات صنف |
| GET | `/api/inventory/by-category` | مخزون موجب مجمَّع حسب الفئة |

### 3.4 الصناع

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/artisans` | جلب الصناع (مع خدماتهم) |
| POST | `/api/artisans` | إنشاء صانع |
| PUT | `/api/artisans/:id` | تحديث صانع |
| DELETE | `/api/artisans/:id` | حذف صانع |
| GET | `/api/artisans/qualified?service_type_id=` | صناع مؤهلون لخدمة |
| GET | `/api/artisans/tdwar` | صناع التدوير فقط |
| GET | `/api/artisans/service` | صناع SERVICE فقط (نوع SERVICE/NULL) |
| GET | `/api/artisans/comparison?period=` | مقارنة أداء الصناع |
| GET | `/api/artisans/:id/dashboard?period=` | لوحة صانع واحد |
| GET | `/api/artisans/:id/expenses?from_date&to_date` | مصاريف صانع |
| POST | `/api/artisans/:id/expenses` | إضافة مصروف/تسبيق |
| GET | `/api/artisans/:id/rates` | تاريخ أسعار صانع |
| POST | `/api/artisans/:id/rates` | إضافة سعر جديد (append-only) |

### 3.5 التصنيع العام

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/manufacturing/orders` | جلب أوامر التصنيع |
| POST | `/api/manufacturing/orders` | إنشاء أمر تصنيع |
| PUT | `/api/manufacturing/orders/:id/complete` | إغلاق أمر (legacy) |
| PUT | `/api/manufacturing/inputs/:inputId/complete` | إكمال مدخل واحد |

### 3.6 نظام التدوير TDWAR

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/api/tdwar/orders` | إنشاء أمر تدوير (متعدد الألوان) |
| PUT | `/api/tdwar/orders/:id/complete` | إغلاق أمر تدوير |
| GET | `/api/tdwar/orders/:id/bags` | خناشي أمر |
| GET | `/api/tdwar/orders/:id/combinations` | تركيبات الألوان لأمر |
| GET | `/api/tdwar/orders/:id/production` | سجلات إنتاج أمر |
| POST | `/api/tdwar/production` | تسجيل إنتاج يومي |
| POST | `/api/tdwar/bags/deliver` | تسليم خنشة جديدة (تغلق السابقة) |
| PUT | `/api/tdwar/bags/:id/complete` | ⛔ مُعطَّل — يُرجع 400 دائماً |
| GET | `/api/tdwar/daily-summary?date=` | ملخص إنتاج يوم |

### 3.7 المبيعات

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/sales?from_date&to_date&client_id&period` | جلب المبيعات مع KPIs |
| POST | `/api/pos/sale` | بيع جديد (POS) |
| DELETE | `/api/sales/:id` | حذف بيع (admin فقط) |
| GET | `/api/sales/:id/revisions` | قائمة مراجعات فاتورة |
| GET | `/api/sales/:id/final` | النسخة النهائية من فاتورة |
| POST | `/api/sales/:id/revision` | إنشاء مراجعة فاتورة |
| POST | `/api/sales/:id/status` | تغيير حالة دورة حياة الفاتورة |
| POST | `/api/sales/:id/credit-note` | إشعار دائن (للمُسلَّمة فقط) |
| POST | `/api/sales/:id/adjustment` | فاتورة تسوية |
| POST | `/api/sales/:id/deposit` | عربون (أرابون) |

### 3.8 الطلبيات الخاصة

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/special-orders?status=` | جلب الطلبيات الخاصة |
| POST | `/api/special-orders` | إنشاء طلبية خاصة |
| PUT | `/api/special-orders/:id` | تحديث حالة/لون طلبية |

### 3.9 المشتريات

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/purchases?from_date&to_date&supplier_id&period` | جلب المشتريات مع KPIs |
| POST | `/api/purchases` | إنشاء فاتورة شراء |

### 3.10 الشيكات

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/checks/portfolio` | محفظة الشيكات |
| GET | `/api/checks/portfolio/available` | شيكات متاحة للتظهير |
| POST | `/api/checks/portfolio` | إضافة شيك |
| PUT | `/api/checks/portfolio/:id/deposit` | تحصيل شيك |
| DELETE | `/api/checks/portfolio/:id` | حذف شيك |
| GET | `/api/checks/issued?from_date&to_date&status&period` | شيكات صادرة مع KPIs |
| POST | `/api/checks/issued` | إضافة شيك صادر |
| PUT | `/api/checks/issued/:id` | تحديث شيك صادر |
| PUT | `/api/checks/issued/:id/pay` | دفع شيك (الصندوق أو البنك) |

### 3.11 الخزينة

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/treasury/balance` | رصيد الصندوق والبنك |
| GET | `/api/treasury/movements?from_date&to_date&account&limit` | حركات الخزينة |
| GET | `/api/treasury/summary` | ملخص شامل |

### 3.12 البيانات المالية

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/clients` | العملاء مع أرصدتهم |
| POST | `/api/clients` | إنشاء عميل |
| PUT | `/api/clients/:id` | تحديث عميل |
| DELETE | `/api/clients/:id` | حذف عميل |
| GET | `/api/suppliers` | الموردون |
| POST | `/api/suppliers` | إنشاء مورد |
| PUT | `/api/suppliers/:id` | تحديث مورد |
| DELETE | `/api/suppliers/:id` | حذف مورد |
| GET | `/api/employees` | الموظفون |
| POST | `/api/employees` | إنشاء موظف |
| PUT | `/api/employees/:id` | تحديث موظف |
| DELETE | `/api/employees/:id` | حذف موظف |
| GET | `/api/partners` | الشركاء |
| POST | `/api/partners` | إنشاء شريك |
| PUT | `/api/partners/:id` | تحديث شريك |
| DELETE | `/api/partners/:id` | حذف شريك |
| GET | `/api/vehicle-tours` | جولات السيارة |
| POST | `/api/vehicle-tours` | إضافة جولة |
| PUT | `/api/vehicle-tours/:id` | تحديث جولة |
| DELETE | `/api/vehicle-tours/:id` | حذف جولة |
| GET | `/api/expenses` | المصروفات |
| POST | `/api/expenses` | إضافة مصروف |
| GET | `/api/opening-balances` | الأرصدة الافتتاحية |
| PUT | `/api/opening-balances` | تحديث الأرصدة الافتتاحية |

### 3.13 التقارير

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/reports/balance-sheet?year=` | الميزانية العمومية |
| GET | `/api/reports/income-statement?year=` | قائمة الدخل |
| GET | `/api/reports/manufacturing-cost-analysis` | تحليل تكاليف التصنيع |
| GET | `/api/reports/inventory-valuation` | تقييم المخزون |
| POST | `/api/reports/distribute-profit` | توزيع الأرباح |

### 3.14 النظام

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/audit/log?table_name&record_id&user&limit` | سجل التدقيق |

---

## 4. صفحات الـ Frontend

### 4.1 الصفحات الموجودة في الـ navbar (`index.html`)

| data-page | الدالة في app.js | الحالة |
|-----------|-----------------|--------|
| `dashboard` | `loadDashboard` | ✅ يعمل |
| `color-codes` | `loadColorCodes` | ✅ يعمل |
| `warehouses` | `loadWarehouses` | ✅ يعمل |
| `product-types` | `loadProductTypes` | ✅ يعمل |
| `service-types` | `loadServiceTypes` | ✅ يعمل |
| `inventory` | `loadInventory` | ✅ يعمل |
| `tdwar` | `loadTDWAR` | ✅ يعمل |
| `artisans` | `loadArtisans` | ✅ يعمل |
| `artisan-dashboard` | `loadArtisanDashboard` | ✅ يعمل |
| `pos` | `loadPOS` | ✅ يعمل |
| `special-orders` | `loadSpecialOrders` | ✅ يعمل |
| `sales` | `loadSales` | ✅ يعمل |
| `purchases` | `loadPurchases` | ✅ يعمل |
| `checks-portfolio` | `loadChecksPortfolio` | ✅ يعمل |
| `checks-issued` | `loadChecksIssued` | ✅ يعمل |
| `treasury` | `loadTreasury` | ✅ يعمل |
| `expenses` | `loadExpenses` | ✅ يعمل |
| `clients` | `loadClients` | ✅ يعمل |
| `suppliers` | `loadSuppliers` | ✅ يعمل |
| `reports` | `loadReports` | ✅ يعمل |

### 4.2 صفحات موجودة في app.js لكن **ليست في navbar**

| data-page | الدالة | الملاحظة |
|-----------|--------|----------|
| `manufacturing` | `loadManufacturing` | ⚠️ موجودة في الكود، غير منسوبة في navbar. يُصل إليها فقط عبر `nav('manufacturing')` برمجياً |

---

## 5. المشاكل والتعارضات المُكتشَفة

### 🔴 مشاكل عملية (تؤثر على الوظائف)

**M1: `cc.name_ar` — عمود غير موجود**
- **الموقع:** `server.js:1916` — endpoint `GET /api/tdwar/orders/:id/combinations`
- **الكود:** `cc.name_ar as color_name`
- **الحقيقة:** جدول `color_codes` لا يحتوي على `name_ar` — الأعمدة هي `code`, `main_color`, `shade`
- **التأثير:** يُرجع `color_name = NULL` دائماً في هذا الـ endpoint

**M2: `manufacturing_orders.color_code_id` — عمود غير موجود**
- **الموقع:** `server.js:3004` — endpoint `GET /api/reports/manufacturing-cost-analysis`
- **الكود:** `LEFT JOIN color_codes cc ON mo.color_code_id = cc.id`
- **الحقيقة:** جدول `manufacturing_orders` لا يحتوي على `color_code_id`
- **التأثير:** `color_code` دائماً NULL في التقرير

**M3: أسماء جداول خاطئة في ترحيل المخزون**
- **الموقع:** `server.js:608-609`
- **الكود:** يُحاول إعادة توجيه FK من `tdwar_order_colors` و `tdwar_order_bags`
- **الحقيقة:** هذه الجداول لا توجد — الأسماء الصحيحة: `tdwar_color_combinations` و `production_bags`
- **التأثير:** خطأ صامت (try/catch يبتلعه) — عند دمج مخزون مكرر، لا تُعاد نقطة FKs لتلك الجداول

**M4: `suppliers.balance` لا يُحدَّث أبداً**
- **الموقع:** جدول `suppliers` يحتوي على `balance`
- **الحقيقة:** عند الشراء بالآجل لا يوجد كود يُحدِّث `suppliers.balance` (بينما `clients.balance` يُحدَّث عند الدين)
- **التأثير:** رصيد الموردين لا يعكس الديون المستحقة

### 🟡 تعارضات في التصميم

**D1: مسار الفاتورة المزدوج (sales_items + invoice_revisions)**
- كل فاتورة جديدة تُسجَّل في `sales_items` (الطريق القديم)
- نظام المراجعات يستخدم `invoice_revision_items` (الطريق الجديد)
- الترحيل التلقائي في الاستار يُنشئ "Revision 1" من `sales_items` لكل فاتورة قديمة
- الربحية تُحسَب عبر نظام المراجعات — إذا فشل الترحيل تتأثر الأرباح

**D2: نظام التدوير مُنقسم بين شاشتين**
- `manufacturing` (الشاشة العامة) — موجودة في الكود لكن ليست في navbar
- `tdwar` (الشاشة المتخصصة) — في navbar وتُصفِّي أوامر التدوير فقط
- كلاهما يجلبان نفس الـ endpoint: `GET /api/manufacturing/orders`
- السبب: تم دمج التدوير في شاشة TDWAR وإخفاء شاشة manufacturing

**D3: `PUT /api/tdwar/bags/:id/complete` مُعطَّل بالكامل**
- الـ endpoint موجود لكن يُرجع 400 دائماً
- الخنشة تُغلق فقط عند: تسليم خنشة جديدة أو إغلاق الأمر

**D4: `artisan_services` و `artisan_service_rates` مُكرَّران**
- `artisan_services`: الجدول القديم — يُستخدم في إنشاء/تحديث الصناع
- `artisan_service_rates`: الجدول الجديد المُعدَّل بالتاريخ — يُستخدم في نظام المراجعات
- البذر التلقائي ينقل `artisan_services` → `artisan_service_rates` بتاريخ '2000-01-01'
- لكن عند تحديث صانع (`PUT /api/artisans/:id`) يُحدَّث فقط `artisan_services` وليس `artisan_service_rates`

### 🔵 ملاحظات تقنية

**T1: CLAUDE.md قديم جداً**
- يقول `server.js = 787 سطر` بينما الواقع 3,903 سطر
- يقول `app.js = 1050 سطر` بينما الواقع 3,396 سطر

**T2: `PUT /api/warehouses/:id` و `PUT /api/product-types/:id` غير موجودَين**
- يمكن إنشاء وحذف المخازن وأنواع المنتجات لكن لا يمكن تعديلها

**T3: `computeRemaining` مُعرَّفة بعد استخدامها في التعليق**
- وظيفة `computeRemaining` مُعرَّفة في السطر 3758 وتُستخدم في السطر 3789 — لا مشكلة لأن JavaScript hoisting يعمل مع function declarations وهذه function declaration عادية

**T4: خطر SQL injection في `special-orders`**
- `server.js:2471`: `WHERE so.status = '${status}'` — يُدخل query param مباشرة في SQL
- ⚠️ هذا ثغرة SQL injection محتملة

**T5: لا يوجد نظام مصادقة**
- USER ثابت = 'admin' في `app.js:2`
- لا يوجد تحقق من الهوية — كل شيء مفتوح

---

## 6. الوضع الحالي الحقيقي — ما يعمل وما لا يعمل

### ✅ يعمل بشكل جيد

| الوحدة | الوضع |
|--------|-------|
| المخزون (CRUD، حركات، دمج تلقائي) | ✅ يعمل |
| التدوير TDWAR (إنشاء أمر، تسجيل إنتاج، إغلاق) | ✅ يعمل |
| الخنشة (فتح، إغلاق عند التسليم، تصنيف المردودية) | ✅ يعمل |
| POS (بيع، دفع متعدد الأنواع، دين عميل) | ✅ يعمل |
| الشيكات (محفظة، تحصيل، صادرة، تظهير) | ✅ يعمل |
| الخزينة (رصيد محسوب، حركات append-only) | ✅ يعمل |
| نظام المراجعات (revision، credit note، adjustment) | ✅ يعمل |
| حساب الأرباح (عبر artisan_rate المُجمَّد) | ✅ يعمل |
| سجل التدقيق | ✅ يعمل |
| لوحة التحكم (KPIs) | ✅ يعمل |
| التقارير المالية (ميزانية، دخل) | ✅ يعمل |
| العربون (أرابون) | ✅ يعمل |
| الصناع (مع تاريخ الأسعار) | ✅ يعمل |

### ⚠️ يعمل مع قيود/أخطاء

| الوحدة | الوضع |
|--------|-------|
| `/api/tdwar/orders/:id/combinations` | يعمل لكن `color_name` دائماً NULL |
| `/api/reports/manufacturing-cost-analysis` | يعمل لكن `color_code` دائماً NULL |
| ترحيل إعادة توجيه FKs عند دمج المخزون | يعمل جزئياً (يفوته جداول الإنتاج) |
| `suppliers.balance` | موجود لكن لا يُحدَّث |
| `PUT /api/warehouses/:id` | غير موجود (لا تعديل) |
| `PUT /api/product-types/:id` | غير موجود (لا تعديل) |

### ❌ لا يعمل

| الوحدة | الوضع |
|--------|-------|
| `PUT /api/tdwar/bags/:id/complete` | مُعطَّل عن قصد — يُرجع 400 |
| صفحة `manufacturing` في navbar | غير موجودة في navbar |

---

## 7. ترتيب الأولويات المقترح للإصلاح

> (للمعلومية فقط — لم يُطلَب إصلاح أي شيء الآن)

1. **فوري:** إصلاح `cc.name_ar` ← `cc.main_color` في `/api/tdwar/orders/:id/combinations`
2. **فوري:** إصلاح SQL injection في `/api/special-orders` (status parameter)
3. **مهم:** إصلاح أسماء الجداول في ترحيل المخزون (`tdwar_order_colors` → `tdwar_color_combinations`)
4. **مهم:** إضافة `PUT /api/warehouses/:id` و `PUT /api/product-types/:id`
5. **متوسط:** مزامنة `artisan_services` → `artisan_service_rates` عند التحديث
6. **متوسط:** آلية تحديث `suppliers.balance` عند الشراء الآجل
7. **منخفض:** إصلاح `manufacturing_orders.color_code_id` في تقرير التكاليف

---

## 8. الترابط والتدفق المالي

```
بيع (POS) ──→ sales + sales_items + sales_payments
                ├─ نقدي ──→ treasury_ledger (الصندوق وارد)
                ├─ تحويل/TPE ──→ treasury_ledger (البنك وارد)
                ├─ شيك ──→ checks_portfolio (معلق)
                └─ آجل ──→ clients.balance +

شراء ──→ purchases + purchases_items + purchases_payments
          ├─ نقدي ──→ treasury_ledger (الصندوق صادر)
          └─ شيك ──→ checks_issued

تحصيل شيك ──→ checks_portfolio.status='محصّل' + treasury_ledger (البنك وارد)
دفع شيك صادر ──→ checks_issued.status='مدفوع' + treasury_ledger (صادر)

مصروف ──→ expenses + treasury_ledger (صادر)
مصروف صانع ──→ artisan_accounts + treasury_ledger (الصندوق صادر)

تدوير ──→ manufacturing_orders + manufacturing_inputs + tdwar_color_combinations
           + production_bags + production_entries
           ← inventory OUT (بوبينات، خناشي)
           → inventory IN (صبرة) + artisan_accounts (مكسب صانع)
```

---

*انتهى التقرير — لم يُعدَّل أي كود في هذه الجلسة*
