# DOMAIN MODEL

This document describes the core entities of the GROFIL ERP system,
their attributes, and their relationships.

It serves as the authoritative domain architecture reference
before implementation begins.

---

# DOMAIN OVERVIEW

The system operates two parallel business flows:

POS_WHOLESALE — thread and accessories distribution
POS_TAILORING — garment finishing orders and artisan services

Both flows share:

- The Customer entity
- The Color catalog
- The Inventory system
- The Accounting and Payment system

---

# DOMAIN MAP

```
Company
└── Branch(es)
    ├── POS_WHOLESALE
    │   ├── Customer
    │   ├── Sales Invoice
    │   │   └── Sale Items (product, color, qty, price)
    │   ├── Payment
    │   └── Inventory Deduction
    │
    ├── POS_TAILORING
    │   ├── Customer
    │   ├── Tailoring Order
    │   │   └── Garment(s)
    │   │       ├── Services (→ Artisan Jobs)
    │   │       └── Materials Used (→ Inventory Deduction)
    │   └── Payment
    │
    ├── Production Workshop
    │   ├── Production Session
    │   │   └── Production Lines (color, combinations, kg)
    │   └── Artisan Service Jobs
    │
    └── Inventory
        ├── Raw Bobbin Inventory
        ├── Wholesale Kg Inventory
        ├── Retail Kg Inventory
        └── Retail Ounce Inventory
```

---

# DOMAIN: COMPANY & BRANCHES

---

## Entity: Company

Description:

The top-level tenant unit in the SaaS model.
Each company operates independently with its own data.

Key Attributes:

- company_id
- company_name
- created_at
- status (Active, Suspended, Closed)

Relationships:

- Has many Branches
- Has many Users
- Has many Customers
- Has many Suppliers
- Has many Colors (shared catalog)
- Has many Products

---

## Entity: Branch

Description:

An operational unit within a company.
Each branch has its own inventory, customers, and transactions.

Key Attributes:

- branch_id
- company_id
- branch_name
- branch_type (Wholesale, Retail, Tailoring, Supplies, Workshop)

Relationships:

- Belongs to Company
- Has many Users
- Has many Customers (branch-level)
- Has many Inventory records
- Has many Sales Invoices
- Has many Production Sessions
- Has many Tailoring Orders

---

# DOMAIN: CUSTOMERS & SUPPLIERS

---

## Entity: Customer

Description:

A person or business that purchases products or tailoring services.
The same customer entity is used for both POS_WHOLESALE and POS_TAILORING.

Key Attributes:

- customer_id
- company_id
- branch_id
- customer_name
- phone
- balance (outstanding debt)

Relationships:

- Belongs to Company and Branch
- Has many Sales Invoices
- Has many Tailoring Orders
- Has many Payments
- Has many Cheques received

---

## Entity: Supplier

Description:

A business that provides raw materials or sewing accessories to the company.

Key Attributes:

- supplier_id
- company_id
- branch_id
- supplier_name
- phone
- balance (amount owed to supplier)

Relationships:

- Belongs to Company and Branch
- Has many Purchase Invoices
- Has many Payments made
- Has many Cheques endorsed to them

---

# DOMAIN: COLOR SYSTEM

---

## Entity: Color Family

Description:

A broad grouping of color shades (e.g., RED, BLUE, GOLD).
Used for shelf organization, filtering, and reporting.

Key Attributes:

- family_id
- company_id
- family_name (RED, BLUE, GREEN, GOLD, etc.)

Relationships:

- Has many Color Shades

---

## Entity: Color (Shade)

Description:

A specific shade of sabra thread identified by a unique code.
The color code is shared across all branches and all inventory stages.

Key Attributes:

- color_id
- company_id
- color_code (e.g., RED-MF102)
- color_family_id
- color_name_ar
- color_name_fr
- hex_value (optional, for UI display)

Relationships:

- Belongs to Color Family
- Used in Wholesale Inventory
- Used in Retail Inventory
- Used in Production Lines
- Used in Tailoring Garments (garment color reference)
- Used in Garment Materials (material color reference)

---

# DOMAIN: INVENTORY

---

## Entity: Inventory

Description:

Tracks the current quantity of a product or color at a specific branch
and inventory stage.

Key Attributes:

- inventory_id
- company_id
- branch_id
- product_id (or color_id for sabra thread)
- inventory_stage (Raw Bobbin, Wholesale Kg, Retail Kg, Retail Ounce)
- quantity
- unit

Relationships:

- Belongs to Branch
- References Product or Color
- Updated by Inventory Movements

---

## Entity: Inventory Movement

Description:

An immutable record of every stock change in the system.
Stock is never edited directly — only through movements.

Key Attributes:

- movement_id
- company_id
- branch_id
- product_id
- color_id
- movement_type
- quantity
- unit
- reference_id (sale_id, order_id, session_id, etc.)
- reference_type (Sale, Purchase, Production, Conversion, Garment Material Consumption, Adjustment)
- created_at

Movement Types:

- Purchase — stock added from supplier
- Sale — stock deducted from wholesale/retail sale
- Production — stock added from production session approval
- Conversion — kg converted to ounces (retail restocking)
- Garment Material Consumption — materials deducted when garment services completed
- Adjustment — manual correction

Relationships:

- Belongs to Branch
- References Product / Color
- Triggered by Sales Invoice, Production Session, or Tailoring Garment completion

---

# DOMAIN: PRODUCTS

---

## Entity: Product

Description:

A sellable or consumable item in the system.
Sabra thread is tracked by color, not as a generic product.
Sewing supplies and accessories are tracked as standard products.

Key Attributes:

- product_id
- company_id
- product_name
- product_type (Sabra Thread, Sewing Supply, Accessory)
- unit (kg, oz, piece, box, meter)

Relationships:

- Has many Inventory records
- Used in Sale Items
- Used in Garment Materials

---

# DOMAIN: WHOLESALE POS

---

## Entity: Sales Invoice

Description:

A commercial document recording a wholesale or retail thread sale.
Also used for inter-branch stock transfers (treated as sales).

Key Attributes:

- sale_id
- company_id
- branch_id
- customer_id
- sale_type (Wholesale, RetailOunce, InterBranch)
- total_amount
- payment_status (Unpaid, Partial, Paid)
- status (Draft, Confirmed, Cancelled)
- created_at

Relationships:

- Belongs to Branch and Customer
- Has many Sale Items
- Has many Payments
- Triggers Inventory Movements on confirmation
- Triggers Accounting Journal Entries

---

## Entity: Sale Item

Description:

A line within a sales invoice representing one product or color sold.

Key Attributes:

- sale_item_id
- sale_id
- product_id (or color_id for thread)
- quantity
- unit
- unit_price
- total_price

Relationships:

- Belongs to Sales Invoice
- References Product or Color

---

# DOMAIN: TAILORING ORDERS

---

## Entity: Tailoring Order

Description:

A customer request for garment finishing services.
One order may contain multiple garments.

Key Attributes:

- order_id
- company_id
- branch_id
- customer_id
- order_date
- status (NEW, IN_PRODUCTION, PARTIAL_READY, READY, DELIVERED)
- total_price
- notes

Relationships:

- Belongs to Branch and Customer
- Has many Tailoring Garments
- Has many Payments
- Triggers Accounting Journal Entries on delivery

---

## Entity: Tailoring Garment

Description:

A single garment within a tailoring order.
One garment may require multiple services and uses multiple materials.

Key Attributes:

- garment_id
- order_id
- garment_type (Caftan, Djellaba, Burnous, etc.)
- color_id (garment color, linked to color catalog)
- quantity
- notes

Relationships:

- Belongs to Tailoring Order
- Has many Tailoring Services
- Has many Garment Materials
- Triggers Inventory Movements (via Garment Materials) when all services are DONE

---

## Entity: Tailoring Service

Description:

A finishing service applied to a specific garment.
Each service is assigned to an artisan and tracked independently.

Key Attributes:

- service_id
- garment_id
- service_type (from Service Catalog: Sfifa, Akaad, Mraim, Trassan, etc.)
- quantity
- unit
- price
- artisan_id
- status (ASSIGNED, IN_PROGRESS, DONE)

Relationships:

- Belongs to Tailoring Garment
- References Service Catalog entry
- Assigned to Artisan
- Status change to DONE triggers garment completion check
- Garment completion triggers Garment Material Consumption

---

## Entity: Garment Materials

Description:

Manual material consumption records entered by the operator at intake.
Materials are consumed when all services on the garment are completed.

Key Attributes:

- material_id
- garment_id
- product_id (material used)
- color_id (material color, e.g., Sabra R205)
- quantity
- unit (qiyad, meter, piece, unit)

Example:

Garment: Caftan Red
└ Garment Materials:
    ├ Sabra R205 → 10 qiyad
    └ Sewing Thread → 1 unit

Relationships:

- Belongs to Tailoring Garment
- References Product and Color
- Triggers Inventory Movement of type Garment Material Consumption
  when the parent garment is completed

---

# DOMAIN: ARTISANS

---

## Entity: Artisan

Description:

A specialized worker who performs garment finishing services.
Distinct from production workers who manufacture sabra thread.

Key Attributes:

- artisan_id
- company_id
- branch_id
- name
- phone
- specialization (Sfifa, Akaad, General)
- status (Active, Inactive)

Relationships:

- Assigned to many Tailoring Services
- Has job history (completed services)
- Reported in artisan productivity dashboard

---

## Entity: Service Catalog

Description:

The company-level catalog of available finishing services.
Defines pricing defaults and service units.
Does NOT control material consumption (that is in Garment Materials).

Key Attributes:

- catalog_id
- company_id
- service_name (Sfifa, Akaad, Mraim, Trassan)
- default_unit (meter, unit, piece)
- base_price

Relationships:

- Referenced by Tailoring Services

---

# DOMAIN: PRODUCTION

---

## Entity: Production Session

Description:

A work session in which a production worker processes raw bobbins
into finished sabra thread.
One session per worker per day.

Key Attributes:

- session_id
- company_id
- branch_id
- worker_id
- session_date
- status (Open, Closed, Approved, Cancelled)

Relationships:

- Belongs to Branch
- Has many Production Lines
- Approval triggers Inventory Movement (Production Output)
- Generates worker wage calculation

---

## Entity: Production Line

Description:

A single color output record within a production session.

Key Attributes:

- line_id
- session_id
- color_id
- combinations (number of combinations processed)
- kilograms_produced (combinations × 0.5)

Formula:

1 combination = 0.5 kg produced

Relationships:

- Belongs to Production Session
- References Color
- Contributes to Wholesale Kg Inventory on session approval

---

## Entity: Production Worker

Description:

An employee who processes bobbins in the production workshop.
Tracked separately from artisans.

Key Attributes:

- worker_id
- company_id
- branch_id
- name
- phone
- status (Active, Inactive)

Wage rule:

6 MAD per kilogram produced

Relationships:

- Assigned to Production Sessions
- Productivity tracked per session and per day

---

# DOMAIN: PAYMENTS & ACCOUNTING

---

## Entity: Payment

Description:

A financial transaction applied against a customer or supplier balance.
Payments are not linked to individual invoices;
they are applied to the account balance.

Key Attributes:

- payment_id
- company_id
- branch_id
- entity_type (Customer, Supplier)
- entity_id
- payment_method (Cash, Cheque, Bank Transfer, TPE)
- amount
- status (Pending, Confirmed, Cancelled)
- created_at

Relationships:

- Applied to Customer or Supplier balance
- May reference a Cheque
- Triggers Accounting Journal Entry

---

## Entity: Cheque

Description:

A physical cheque received from a customer or issued to a supplier.
Cheques have a lifecycle that must be fully tracked.

Key Attributes:

- cheque_id
- company_id
- cheque_number
- issuer_name
- bank_name
- amount
- issue_date
- due_date
- status (Received, Deposited, Cleared, Returned, Endorsed)
- customer_id (who gave the cheque)
- supplier_id (endorsed to, if applicable)

Relationships:

- Received from Customer
- May be Endorsed to Supplier
- Linked to Payment records
- Tracked in Cheque Portfolio

---

## Entity: Journal Entry

Description:

An accounting record generated automatically by every financial operation.
Follows double-entry bookkeeping.

Key Attributes:

- entry_id
- company_id
- entry_date
- description
- reference_type (Sale, Purchase, Payment, Production, TailoringOrder)
- reference_id

Relationships:

- Has many Journal Lines
- Referenced to its source transaction

---

## Entity: Journal Line

Description:

A single debit or credit line within a journal entry.

Key Attributes:

- line_id
- entry_id
- account_id
- debit
- credit

Relationships:

- Belongs to Journal Entry
- References Account

---

## Entity: Account

Description:

A chart-of-accounts entry used in double-entry bookkeeping.

Key Attributes:

- account_id
- company_id
- account_name
- account_type (Asset, Liability, Revenue, Expense, Equity)

Common accounts:

- Cash
- Accounts Receivable (Customer)
- Accounts Payable (Supplier)
- Inventory
- Sales Revenue — Wholesale
- Sales Revenue — Retail
- Sales Revenue — Tailoring Services
- Production Wages Expense
- Artisan Wages Expense

Relationships:

- Used in Journal Lines
- Summarized in Trial Balance, Balance Sheet, Profit & Loss

---

# ENTITY RELATIONSHIP SUMMARY

```
Company
└── Branch
    ├── Customer ──────────────── Payment
    │                               └── Cheque
    ├── Sales Invoice
    │   └── Sale Items ─────────── Color / Product
    │       └── Inventory Movement (Sale)
    │
    ├── Tailoring Order ─────────── Customer
    │   └── Tailoring Garment ───── Color
    │       ├── Tailoring Service ── Artisan
    │       │   └── Service Catalog
    │       └── Garment Materials ── Product / Color
    │           └── Inventory Movement (Garment Material Consumption)
    │
    ├── Production Session ──────── Production Worker
    │   └── Production Lines ─────── Color
    │       └── Inventory Movement (Production Output)
    │
    ├── Purchase Invoice ─────────── Supplier
    │   └── Purchase Items ─────────── Product / Color
    │       └── Inventory Movement (Purchase)
    │
    └── Inventory
        ├── Raw Bobbin Stock
        ├── Wholesale Kg Stock ─────── Color
        ├── Retail Kg Stock ─────────── Color
        └── Retail Ounce Stock ──────── Color
```

---

# CROSS-DOMAIN INTERACTION RULES

1. Inventory is never edited directly.
   All changes go through Inventory Movements.

2. Wholesale → Retail stock movement is recorded as a Sale,
   not as an internal transfer.

3. Materials consumed by tailoring garments are entered manually
   per garment (garment_materials), not derived from service catalog.

4. Material deduction occurs when all services of a garment are DONE.

5. Production session output enters Wholesale Kg Inventory
   only after supervisor approval.

6. A single payment may settle part of a customer or supplier balance.
   Payments are not invoice-specific.

7. Every financial event generates an automatic Journal Entry.
   Manual journal entry for normal operations is not required.

8. Color codes are global and shared across all branches,
   all inventory stages, and both POS flows.
