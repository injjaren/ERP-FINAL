# DATA FLOW

This document describes the complete operational data flows of the GROFIL ERP system.

It is based on:

- DOMAIN_MODEL.md
- ARCHITECTURE.md
- DATABASE_SCHEMA.md
- TAILORING_SYSTEM.md
- INVENTORY_SYSTEM.md
- WHOLESALE_SYSTEM.md
- ACCOUNTING_INTEGRATION.md

The goal is to validate all operational flows before implementation begins.

---

# FLOW 1: WHOLESALE SALES FLOW

## Overview

A customer purchases sabra thread or accessories by kilogram, ounce, or piece.
Payment may be immediate, partial, or deferred.

## Step-by-step

```
[CUSTOMER]
    │
    │ walks in / calls
    ▼
[POS_WHOLESALE — Cashier Screen]
    │
    │ 1. Cashier selects or creates Customer
    │ 2. Cashier adds products to cart:
    │      - Color Code, Quantity (kg / oz / piece), Unit Price
    │ 3. Cashier confirms invoice
    ▼
[SALES INVOICE — status: Draft → Confirmed]
    │
    │ On confirmation:
    │   a. Each Sale Item deducts from Inventory
    │   b. Accounting Journal Entry is generated
    │   c. Customer balance is updated if not fully paid
    ▼
[INVENTORY MOVEMENT — type: Sale]
    │
    │ - product_id / color_id
    │ - quantity (negative)
    │ - branch_id
    │ - reference: sale_id
    ▼
[CUSTOMER ACCOUNT]
    │
    │ If fully paid:   balance unchanged, payment recorded
    │ If partial:      remaining amount added to customer balance
    │ If credit:       full amount added to customer balance
    ▼
[PAYMENT]
    │
    │ Method: Cash / Cheque / Bank Transfer / TPE
    │ May arrive later (post-dated cheque, deferred payment)
    ▼
[ACCOUNTING JOURNAL ENTRY — auto-generated]

    Invoice Creation:
      Debit:  Accounts Receivable (Customer)
      Credit: Sales Revenue — Wholesale

    Payment Receipt:
      Debit:  Cash or Bank or Cheque Portfolio
      Credit: Accounts Receivable (Customer)
```

## Inventory Stage Affected

```
POS_WHOLESALE:  Wholesale Kg Inventory    → Sale deducts kg stock
POS_RETAIL:     Retail Ounce Inventory    → Sale deducts oz stock
Inter-Branch:   Wholesale → Retail        → Treated as a Sale (not a transfer)
```

## Trigger Summary

| Event | Triggered Action |
|---|---|
| Invoice Confirmed | Inventory Movement (Sale) |
| Invoice Confirmed | Journal Entry (Revenue) |
| Invoice Confirmed | Customer balance update (if unpaid) |
| Payment Received | Journal Entry (Cash / Bank) |
| Cheque Received | Cheque Portfolio entry |

---

# FLOW 2: TAILORING ORDER FLOW

## Overview

A customer brings garments and requests finishing services.
Services are assigned to artisans. Materials are consumed on garment completion.
Payment is collected at delivery.

## Step-by-step

```
[CUSTOMER]
    │
    │ brings garment(s)
    ▼
[POS_TAILORING — Cashier / Intake Screen]
    │
    │ 1. Cashier selects or creates Customer
    │ 2. Creates Tailoring Order (status: NEW)
    │ 3. Adds Garment(s) to the order:
    │      - Garment type, Color (from catalog), Quantity, Notes
    │ 4. Adds Services per Garment:
    │      - Service type (from catalog), Quantity, Unit, Price
    │ 5. Adds Garment Materials manually:
    │      - Product, Color, Quantity, Unit
    │      Example: Sabra R205 → 10 qiyad
    │ 6. Reviews total price
    │ 7. Confirms the order
    ▼
[TAILORING ORDER — status: NEW → IN_PRODUCTION]
    │
    ├── Tailoring Garment #1
    │     ├── Services: [Sfifa, Akaad, Mraim]  → each gets status: ASSIGNED
    │     └── Materials: [Sabra R205 × 10 qiyad, Thread × 1]
    │
    └── Tailoring Garment #2 (if any)
          ├── Services: [...]
          └── Materials: [...]
    │
    ▼
[ARTISAN JOB BOARD — Supervisor Screen]
    │
    │ Supervisor assigns each service to an Artisan
    │ Service status: ASSIGNED → IN_PROGRESS → DONE
    ▼
[ARTISAN performs the service]
    │
    │ Supervisor or artisan marks service as DONE
    ▼
[GARMENT COMPLETION CHECK]
    │
    │ Are all services for this garment DONE?
    │
    │ NO  → order stays IN_PRODUCTION / PARTIAL_READY
    │
    │ YES → Garment is complete
    │         └── Process Garment Materials:
    │               For each garment_materials entry:
    │                 Record Inventory Movement (Garment Material Consumption)
    ▼
[INVENTORY MOVEMENT — type: Garment Material Consumption]
    │
    │ - product_id, color_id
    │ - quantity (negative)
    │ - unit
    │ - reference: garment_id
    │ Source: Retail Inventory
    ▼
[ORDER STATUS UPDATE]
    │
    │ All garments complete?
    │   YES → Order status: READY
    │   NO  → Order status: PARTIAL_READY
    ▼
[CUSTOMER NOTIFIED — Order ready for pickup]
    │
    ▼
[DELIVERY — Cashier marks order: DELIVERED]
    │
    │ Payment collected (Cash / Partial / Credit)
    ▼
[PAYMENT]
    │
    ▼
[ACCOUNTING JOURNAL ENTRY — auto-generated]

    Order Delivery:
      Debit:  Accounts Receivable (Customer)
      Credit: Sales Revenue — Tailoring Services

    Payment Receipt:
      Debit:  Cash or Bank
      Credit: Accounts Receivable (Customer)
```

## Trigger Summary

| Event | Triggered Action |
|---|---|
| Order Confirmed | Services created with ASSIGNED status |
| Service → DONE | Garment completion check |
| All Services DONE for Garment | Inventory Movement per garment_materials entry |
| All Garments DONE | Order status → READY |
| Order DELIVERED | Journal Entry (Service Revenue) |
| Payment Collected | Journal Entry (Cash / Bank) |

---

# FLOW 3: PRODUCTION FLOW

## Overview

Workers process raw bobbins into finished sabra thread.
Output enters Wholesale Kg Inventory after supervisor approval.

## Step-by-step

```
[SUPERVISOR / OPERATOR]
    │
    │ Opens Production Session for a worker
    ▼
[PRODUCTION SESSION — status: Open]
    │
    │ Operator records Production Lines:
    │   - Color Code
    │   - Number of combinations processed
    │   - Formula: kg = combinations × 0.5
    │
    │ Example:
    │   Color RED-MF102 — 8 combinations → 4 kg
    │   Color BLUE-MF205 — 6 combinations → 3 kg
    ▼
[WORKER FINISHES DAY]
    │
    │ Operator closes session
    ▼
[PRODUCTION SESSION — status: Closed]
    │
    │ Supervisor reviews session data
    │ Verifies quantities
    ▼
[SUPERVISOR APPROVES SESSION]
    │
    ▼
[PRODUCTION SESSION — status: Approved]
    │
    │ For each Production Line:
    │   Record Inventory Movement (Production Output)
    ▼
[INVENTORY MOVEMENT — type: Production]
    │
    │ - color_id
    │ - quantity: +N kg
    │ - inventory_stage: Wholesale Kg
    │ - reference: session_id
    ▼
[WHOLESALE KG INVENTORY UPDATED]
    │
    │ Stock for that color increases
    │ Available for Wholesale Sales
    ▼
[WORKER WAGE CALCULATED]
    │
    │ Total kg produced × 6 MAD/kg
    │ Recorded as Artisan/Production Wage Expense
    ▼
[ACCOUNTING JOURNAL ENTRY — auto-generated]

    Production Output:
      Debit:  Inventory (Wholesale Kg)
      Credit: Production Cost / WIP

    Worker Wage:
      Debit:  Production Wages Expense
      Credit: Wages Payable (or Cash)
```

## Trigger Summary

| Event | Triggered Action |
|---|---|
| Session Approved | Inventory Movement (Production Output) per line |
| Session Approved | Wholesale Kg Inventory increased |
| Session Approved | Worker wage calculated |
| Session Approved | Journal Entry (Inventory + Wages) |

---

# FLOW 4: INVENTORY FLOW

## Overview

Inventory is never edited directly.
Every stock change is recorded as an Inventory Movement.
The current inventory quantity is always the sum of all movements.

## Inventory Stages

```
Raw Bobbin Inventory
    │
    │ consumed by Production Sessions
    ▼
Wholesale Kg Inventory  ◄─── Production Output
    │
    │ reduced by: Wholesale Sales
    │             Inter-Branch Sales (to Retail branch)
    ▼
Retail Kg Inventory  ◄─── Inter-Branch Sale (from Wholesale)
    │
    │ converted to ounces for shelf stock
    ▼
Retail Ounce Inventory  ◄─── Conversion (1 kg = 32 oz)
    │
    │ reduced by: Retail Ounce Sales
    │             Garment Material Consumption (tailoring)
    ▼
[Stock depleted]
```

## Movement Type Reference

| Movement Type | Source Document | Inventory Effect |
|---|---|---|
| Purchase | Purchase Invoice (confirmed) | + stock to Raw Bobbin or Suppies inventory |
| Production | Production Session (approved) | + kg to Wholesale Kg Inventory |
| Sale | Sales Invoice (confirmed) | − stock from relevant inventory stage |
| Conversion | Manual Conversion Record | − kg from Retail Kg, + oz to Retail Ounce |
| Garment Material Consumption | Tailoring Garment completion | − from Retail Inventory per garment_materials |
| Adjustment | Manual Adjustment record | + or − for corrections |

## Movement Record Fields

Every movement records:

```
movement_id
company_id
branch_id
product_id / color_id
movement_type
quantity          (+ for in, − for out)
unit
inventory_stage   (Wholesale Kg, Retail Ounce, etc.)
reference_id      (sale_id / session_id / garment_id / ...)
reference_type    (Sale / Production / Garment Material Consumption / ...)
created_at
```

## Retail Restocking Flow

```
[Manager decides to restock shelf]
    │
    ▼
[Conversion Record created]
    │
    │ -1 kg from Retail Kg Inventory
    │ +32 oz to Retail Ounce Inventory
    │ color_id: same, branch_id: same
    ▼
[Two Inventory Movements recorded]
    │
    │ Movement 1: Conversion OUT — Retail Kg − 1
    │ Movement 2: Conversion IN  — Retail Ounce + 32
```

---

# FLOW 5: ACCOUNTING FLOW

## Overview

Every financial operation automatically generates a Journal Entry.
No manual accounting entry is required for normal operations.
The system uses double-entry bookkeeping.

## Event → Journal Entry Map

### Wholesale Sale Invoice (Confirmed)

```
Debit:  Accounts Receivable — [Customer]   +amount
Credit: Sales Revenue — Wholesale          +amount
```

### Retail Ounce Sale Invoice (Confirmed)

```
Debit:  Accounts Receivable — [Customer]   +amount
Credit: Sales Revenue — Retail             +amount
```

### Tailoring Order (Delivered)

```
Debit:  Accounts Receivable — [Customer]   +total_price
Credit: Sales Revenue — Tailoring Services +total_price
```

### Payment Received (Cash)

```
Debit:  Cash                               +amount
Credit: Accounts Receivable — [Customer]   −amount
```

### Payment Received (Cheque)

```
Debit:  Cheque Portfolio                   +amount
Credit: Accounts Receivable — [Customer]   −amount

  When cheque clears:
  Debit:  Bank Account                     +amount
  Credit: Cheque Portfolio                 −amount

  If cheque bounces:
  Debit:  Accounts Receivable — [Customer] +amount
  Credit: Cheque Portfolio                 −amount
```

### Purchase Invoice (Confirmed)

```
Debit:  Inventory / Raw Material           +amount
Credit: Accounts Payable — [Supplier]      +amount
```

### Supplier Payment

```
Debit:  Accounts Payable — [Supplier]      −amount
Credit: Cash / Bank / Cheque               −amount
```

### Production Session (Approved)

```
Debit:  Wholesale Inventory                +production_value
Credit: Production Cost / WIP              +production_value

Debit:  Production Wages Expense           +wage_amount
Credit: Wages Payable                      +wage_amount
```

## Branch Revenue Separation

Each branch's revenue is tracked on separate accounts:

```
Sales Revenue — Wholesale Sabra
Sales Revenue — Retail Sabra
Sales Revenue — Tailoring Services
Sales Revenue — Sewing Supplies
```

This enables financial analysis per branch and per business unit.

---

# FLOW 6: COLOR INVENTORY FLOW

## Overview

Color is the primary tracking dimension for sabra thread.
The same color code is used across all inventory stages,
production, wholesale, retail, and tailoring.

## Color Lifecycle Flow

```
[COLOR CATALOG]
  Color Code: RED-MF102
  Family: RED
  HEX: #C41E3A
    │
    │ Referenced in:
    ▼
┌─────────────────────────────────────────────────────┐
│  Inventory Stage           │  Unit   │  Example qty │
├────────────────────────────┼─────────┼──────────────┤
│  Raw Bobbin Inventory      │ bobine  │  20          │
│  Wholesale Kg Inventory    │ kg      │  45 kg       │
│  Retail Kg Inventory       │ kg      │  6 kg        │
│  Retail Ounce Inventory    │ oz      │  48 oz       │
└────────────────────────────┴─────────┴──────────────┘
    │
    │ Color flows through stages:
    ▼
[Production]
  Worker processes RED-MF102 bobbins
  → Production Line: 8 combinations × 0.5 = 4 kg
  → Inventory Movement: +4 kg to Wholesale Kg Inventory
    │
    ▼
[Wholesale Sale]
  Customer buys RED-MF102 — 2 kg
  → Inventory Movement: −2 kg from Wholesale Kg Inventory
    │
    ▼
[Inter-Branch Transfer (treated as Sale)]
  Wholesale sells RED-MF102 — 5 kg to Retail branch
  → Wholesale Inventory Movement: −5 kg (Sale)
  → Retail Kg Inventory Movement: +5 kg (Purchase)
    │
    ▼
[Shelf Restocking (Conversion)]
  Retail converts 1 kg to 32 oz
  → Inventory Movement: −1 kg from Retail Kg
  → Inventory Movement: +32 oz to Retail Ounce
    │
    ▼
[Retail Sale]
  Customer buys RED-MF102 — 8 oz
  → Inventory Movement: −8 oz from Retail Ounce Inventory
    │
    ▼
[Tailoring — Garment Material Consumption]
  Garment uses Sabra R205 (e.g., RED-MF102) — 10 qiyad
  → Garment materials entered manually by operator
  → On garment completion:
    Inventory Movement: −10 qiyad from Retail Inventory
    type: Garment Material Consumption
```

## Color Demand Tracking

The system aggregates movements by color_id to calculate:

- Total production per color (from Production Lines)
- Total wholesale sales per color (from Sale Items)
- Total retail sales per color (from Sale Items)
- Total consumed in tailoring per color (from Garment Material Consumption movements)
- Current stock per color per stage

This feeds the Color Analytics and Demand dashboards.

---

# FLOW 7: MULTI-BRANCH FLOW

## Overview

Each company may operate multiple branches.
Branches operate independently but share the color catalog and user authentication.
All branch data is separated by branch_id.

## Branch Data Isolation

```
Company: GROFIL
│
├── Branch: Wholesale Sabra  (branch_id: 1)
│     ├── Customers (wholesale clients)
│     ├── Suppliers (bobbin importers)
│     ├── Inventory: Raw Bobbin + Wholesale Kg
│     ├── Sales Invoices (kg-based)
│     └── Production Sessions
│
├── Branch: Retail Sabra     (branch_id: 2)
│     ├── Customers (tailors, sfifa makers)
│     ├── Inventory: Retail Kg + Retail Ounce
│     ├── Sales Invoices (oz-based)
│     └── Tailoring Orders
│
└── Branch: Sewing Supplies  (branch_id: 3)
      ├── Customers (craft buyers)
      ├── Suppliers (accessory suppliers)
      ├── Inventory: Supplies (piece / box)
      └── Sales Invoices (piece-based)
```

## Inter-Branch Stock Movement

```
Wholesale Branch sells to Retail Branch:

Step 1: Wholesale issues a Sales Invoice
        Customer = Retail Branch (as a customer entity)
        Items: RED-MF102 — 5 kg

Step 2: Invoice confirmed:
        Inventory Movement:
          branch_id: 1 (Wholesale)
          type: Sale
          quantity: −5 kg
          color_id: RED-MF102

Step 3: Retail Branch creates a Purchase Invoice
        Supplier = Wholesale Branch (as a supplier entity)

Step 4: Purchase confirmed:
        Inventory Movement:
          branch_id: 2 (Retail)
          type: Purchase
          quantity: +5 kg
          color_id: RED-MF102
```

## Multi-Branch Accounting

Each branch tracks revenue and expenses separately.

```
Branch Wholesale → Sales Revenue — Wholesale Sabra account
Branch Retail    → Sales Revenue — Retail Sabra account
Branch Retail    → Sales Revenue — Tailoring Services account
Branch Supplies  → Sales Revenue — Sewing Supplies account
```

Company-level reports consolidate all branches.

## POS Sessions per Branch

Each POS session is tied to a branch:

```
POS_WHOLESALE session
  branch_id: 1
  user_id: [cashier]
  all transactions scoped to branch 1

POS_TAILORING session
  branch_id: 2
  user_id: [cashier]
  all tailoring orders scoped to branch 2
```

A user with multi-branch access may switch branches within the same session.
All data remains branch-scoped.

---

# FULL SYSTEM TRIGGER MAP

The table below summarizes every system action triggered by each user operation:

| User Action | Document Created | Inventory Moved | Journal Entry | Balance Updated |
|---|---|---|---|---|
| Confirm Wholesale Invoice | Sales Invoice | ✅ Sale (−stock) | ✅ Revenue | ✅ Customer |
| Confirm Purchase Invoice | Purchase Invoice | ✅ Purchase (+stock) | ✅ Payable | ✅ Supplier |
| Approve Production Session | — | ✅ Production (+kg) | ✅ Inventory / Wages | — |
| Shelf Restocking | Conversion Record | ✅ Conversion (−kg / +oz) | — | — |
| Confirm Tailoring Order | Tailoring Order | — | — | — |
| Mark Service DONE | — | When garment complete: ✅ Material Consumption | — | — |
| Mark Order DELIVERED | — | — | ✅ Service Revenue | ✅ Customer |
| Record Payment (Cash) | Payment | — | ✅ Cash in | ✅ Customer / Supplier |
| Record Payment (Cheque) | Cheque | — | ✅ Cheque Portfolio | ✅ Customer |
| Cheque Cleared | — | — | ✅ Bank in | — |
| Cheque Bounced | — | — | ✅ Reverse | ✅ Customer (re-debited) |
| Manual Adjustment | Adjustment Record | ✅ Adjustment | Optional | — |

---

# DESIGN CONSTRAINTS

1. Inventory is append-only via movements. Stock is never directly edited.

2. Documents drive all system state. No orphan actions exist.

3. Journal entries are generated automatically. Cashiers do not touch accounting.

4. Color codes are global across all branches and stages.

5. Material quantities in tailoring are always manually entered per garment.
   No automatic calculation from service type.

6. Inter-branch transfers are always sales, never internal transfers.

7. Customer and supplier balances are ledger-computed from invoices and payments.
   Direct balance editing is not allowed.

8. All records carry company_id and branch_id for full SaaS data isolation.
