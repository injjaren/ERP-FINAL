# GROFIL ERP - AI Development Handoff Report

## 1. Project Overview
The GROFIL ERP system is a comprehensive, multi-branch Enterprise Resource Planning application designed to manage the entire lifecycle of thread manufacturing (Sabra), accessories distribution, and garment tailoring services. It handles inventory, manufacturing (production sessions), sales (POS), accounting with double-entry bookkeeping, and artisan management within a SaaS multi-tenant model.

## 2. Business Model
The business operates across three distinct branches that handle different product lines and services:
- **Wholesale Sabra (الجملة):** Handles raw bobbin conversion to finished sabra thread (kilograms). It acts as the primary distributor, managing bulk thread inventory, combinations, manufacturing sessions, and wholesale transactions.
- **Retail Sabra (التقسيط):** Handles retail sales of sabra thread (kilograms and ounces) and also houses the **Tailoring Module**. It manages customer garment finishing orders, assigns artisan services (Sfifa, Akaad, etc.), and tracks manual material consumption per garment. 
- **Sewing Supplies (لوازم الخياطة):** A dedicated branch for selling standard sewing accessories and supplies. It operates with a simplified POS and does not utilize the sabra-specific color system.

**Interaction:** Wholesale is the primary supplier to Retail. Transfers between these branches are treated as commercial internal sales (Branch Transfers) with respective accounting implications.

## 3. System Architecture
- **Backend Technologies:** Node.js, Express.js.
- **Database System:** SQLite (using `better-sqlite3`).
- **Frontend:** Vanilla JavaScript, HTML, CSS (No heavy framework, UI relies on DOM manipulation via `app.js`).
- **Main Architectural Principles:** 
  - **Multi-tenancy:** Enforced via `company_id` on almost every table (handled by `companyMiddleware`).
  - **Branch Data Isolation:** Strict isolation utilizing `branch_id` ensuring branches do not mix customers, suppliers, accounting, and inventory.
  - **Append-only Inventory/Accounting:** Direct edits to stock or ledgers are forbidden; everything uses `inventory_movements` and `journal_entries`.

## 4. Database Architecture
- **Important Tables:** `branches`, `inventory`, `inventory_movements`, `sales`, `tailoring_orders`, `journal_entries`, `branch_transfers`, `color_master`, `production_sessions`.
- **Use of `branch_id`:** Enforces spatial data separation. Most entities (clients, suppliers, warehouses, transactions) belong specifically to a branch.
- **Branch Isolation Implementation:** Implemented at the API route level and SQL query level (`WHERE company_id = ? AND branch_id = ?`). The session stores the selected `branch_id` upon user login and UI scopes navigation modules accordingly (e.g., tailoring is visible only in Retail).

## 5. Color System
- **How it works:** A unified, global `color_master` and `color_families` catalog. Colors consist of families (e.g., RED) and specific shades (supplier color codes).
- **Branches using it:** Wholesale Sabra and Retail Sabra. (Explicitly excluded from Sewing Supplies).
- **Inventory per color:** Inventory tables link directly to `color_code_id`/`master_color_id`. Inventory tracking explicitly separates kilograms vs ounces per color.

## 6. Inventory Model
- **Storage and Tracking:** Inventory is strictly tied to a `warehouse_id` and tracked by `inventory_stage` (`raw_bobbin`, `wholesale_kg`, `retail_kg`, `retail_oz`, `supplies`).
- **Modifications:** Stock (`inventory.quantity`) is updated *only* when an `inventory_movement` record is successfully inserted within an SQL transaction.
- **Independent Stock:** Warehouses are tied to specific branches. A branch can only query and sell from its assigned warehouse(s).

## 7. Accounting and Treasury
- **Accounting Separation:** The system uses double-entry bookkeeping (`journal_entries`, `journal_lines`). Queries for Trial Balance, Profit & Loss, Ledger, and Balance Sheet vigorously filter by `branch_id` + `company_id` to ensure branch financials do not bleed into each other.
- **Treasury Balances:** Treasury and expenses are isolated per branch. Payments apply to customer/supplier account balances generally rather than being strictly invoice-linked.

## 8. POS System
- **Current Implementation:** Standard POS for generic item sales, a designated Wholesale POS, a specialized Tailoring POS, and a customized exact POS for Sewing Supplies.
- **Limitations:** The POS for Sewing Supplies bypasses the color system entirely. Colors might not yet be fully integrated or polished in certain legacy POS retail interfaces or the Tailoring POS intake might still require UX refinement for assigning exact sabra colors to garments.

## 9. Inter-Branch Trade
- **Current Flow:** Wholesale selling to Retail is tracked via an internal "Branch Transfer" mechanism (`branch_transfers`). It decreases Wholesale inventory, increases Retail inventory, and posts internal ledger entries (DR 1104 / CR 4100 on Wholesale; DR 1105 / CR 2101 on Retail).
- **Future Automation Goal:** Retail needs to be treated distinctly as a standard customer of Wholesale. Future automation should automatically convert a "Wholesale Sale" directly into a "Retail Purchase" invoice rather than just a stock transfer.

## 10. Implemented Features
- Multi-tenant company setup and strict branch isolation architecture.
- Full Color Master system with families and supplier codes.
- Append-only Inventory Movements and Double-Entry Accounting.
- Artisan Manufacturing Engine (TDWAR and Work Sessions).
- Tailoring Module (Orders, Garments, Artisan Services assignment).
- Dynamic Sidebar Navigation based on chosen branch type.
- Checks Portfolio Management.

## 11. Known Issues / Incomplete Areas
- **Inter-branch commercial flows:** Currently uses `branch_transfers`, but needs migration to a strict Sale/Purchase document automation.
- **Architectural Risk:** Direct DB queries without ORM mean every new feature must manually enforce `company_id` and `branch_id` WHERE clauses. Forgetting this breaks data isolation.
- **POS Color Integration:** Handling edge cases in the POS where users might need to split units or do rapid color lookups is an ongoing UI refinement.

## 12. Current Development Focus
- Refining the POS specific interfaces (tailoring intake, supplies POS checkout).
- Completing the transition of inter-branch trade to an automated Wholesale Sale → Retail Purchase invoice system.
- Solidifying Accounting reporting dynamically per branch (ensuring zero-state defaults for new branches like Retail / Sewing Supplies).

## 13. Important Architectural Rules (MUST NOT BREAK)
1. **Branch Isolation:** Always include `company_id` AND `branch_id` in SQL queries for transactional data out of `req.company_id` and `req.session.branch_id`.
2. **Immutable Ledgers:** Inventory quantities and financial balances MUST only change via inserts into `inventory_movements` and `journal_entries`.
3. **Color System Scoping:** The color catalog (`master_colors`) is shared globally per company. Do NOT add `branch_id` to color definitions.
4. **Tailoring Location:** The tailoring logic belongs strictly to the **Retail** branch context, not Supplies or Wholesale.
5. **No Cascading Deletes on Financials:** Invoices, movements, and journal entries cannot be hard-deleted if they affect historical accounting ledgers.
