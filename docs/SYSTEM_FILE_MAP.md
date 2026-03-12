# GROFIL ERP - System File Map

This document outlines the file structure and key modules of the GROFIL ERP project to assist AI models and developers in navigating the codebase.

## 1. Root Project Structure
Located at `c:\Users\HP\Desktop\ملفات العمل على ERP-SAAS\ERP-FINAL-BACKUP`

```text
/
├── server/                 # Backend Node.js application
├── public/                 # Frontend Vanilla JS/HTML/CSS application
├── docs/                   # System architecture and documentation
├── database/               # SQLite database files and backups
├── logs/                   # System error/activity logs
├── tmp_tables.js           # Temporary utilities script
├── apply-fixes.js          # Migration/fix script
├── start.bat               # Windows startup script
├── package.json            # NPM dependencies (Backend)
└── docker-compose.yml      # Docker container configuration
```

## 2. Backend Structure (`/server`)

```text
/server
├── app.js                  # Express application setup, middleware, and route registration
├── server.js               # Main entry point (starts HTTP server)
├── database/               # Database Layer
│   ├── index.js            # DB connection export
│   ├── connection.js       # SQLite connection logic
│   ├── schema.js           # Full SQL schema definitions
│   └── migrations.js       # DB schema evolution scripts
├── middleware/             # Express Middlewares
│   ├── company.js          # Multi-tenant context (req.company_id)
│   └── auth.js             # Basic authentication/session guards
├── routes/                 # API Endpoints (Controllers)
│   ├── accounting.js       # Financial reporting, trial balance, P&L
│   ├── auth.js             # Login / Logout
│   ├── branches.js         # Branch CRUD and Inter-Branch Transfers
│   ├── colors.js           # Color catalog (families & supplier codes)
│   ├── dashboard.js        # Home statistics and charts
│   ├── inventory.js        # Stock viewing and movements
│   ├── master-data.js      # Customers, suppliers, artisans, products
│   ├── purchases.js        # Supplier invoices
│   ├── sales/              # Customer invoices (POS Wholesale/Retail)
│   ├── tailoring.js        # Tailoring orders, garments, artisan dispatch
│   ├── treasury.js         # Income/expense ledger tracking
│   ├── checks.js           # Checks portfolio (issued and received)
│   └── manufacturing/      # Sabra production session engine
├── services/               # Reusable Business Logic Layer
│   ├── inventoryService.js # Shared inventory deduction/addition logic
│   └── tailoringService.js # Complex tailoring workflow abstractions
└── utils/                  # Helper Functions
    ├── accounting.js       # Double-entry journal creation (createJournalEntryV7)
    ├── inventory.js        # Inventory movement tracking utilities
    ├── audit.js            # Audit logging mechanism
    └── crud.js             # Generic DB operations
```

## 3. Frontend Structure (`/public`)

The frontend is a lightweight Vanilla JS Single Page Application (SPA).

```text
/public
├── index.html              # Main application shell (sidebar, topbar, content area)
├── login.html              # Authentication page with branch selector
├── styles.css              # Custom styling, Vanilla CSS
└── app.js                  # Massive monolithic frontend logic handler containing:
                            #  - API fetch wrappers
                            #  - Routing logic (nav function)
                            #  - All screen rendering components (POS, Dashboard, etc.)
```

## 4. Documentation (`/docs`)

```text
/docs
├── 00_PROJECT_CONTEXT.md     # High-level project origin and goal
├── 01_BUSINESS_MODEL.md      # Business explanation of Sabra/Tailoring
├── DOMAIN_MODEL.md           # Core entities and relationships definitions
├── DATABASE_SCHEMA.md        # Database explanation
├── ARCHITECTURE.md           # Technical rules (Append-only, multi-tenant)
├── API_SPEC.md               # API endpoint definitions
├── BRANCH_ARCHITECTURE_RULES.md # Rules for isolating data per branch
├── COLOR_SYSTEM.md           # How the global color catalog works
├── ACCOUNTING_INTEGRATION.md # Double-entry bookkeeping rules
├── TAILORING_SYSTEM.md       # Logic for Retail garment finishing
├── SYSTEM_OVERVIEW.md        # Brief on all systems
├── DATA_FLOW.md              # Examples of lifecycle data flow
└── AI_HANDOFF_REPORT.md      # State of the project for AI continuation
```

## 5. Important System Files

Critical files handling core business logic:
- **Inventory Logic:** `server/routes/inventory.js`, `server/services/inventoryService.js`, `server/utils/inventory.js`
- **Accounting Logic:** `server/routes/accounting.js`, `server/routes/treasury.js`, `server/utils/accounting.js`
- **POS Logic:** `server/routes/sales` (Backend), `public/app.js` -> `window.loadPOS`, `window.loadTailoringPOS`, `window.loadPOSSupplies` (Frontend)
- **Color System:** `server/routes/colors.js` (Backend API), `public/app.js` -> `window.loadColorManagement`
- **Tailoring Module:** `server/routes/tailoring.js`, `server/services/tailoringService.js`
- **Inter-branch Transfers:** `server/routes/branches.js` (`POST /branch-transfers`)
- **Database Schema:** `server/database/schema.js` (Contains all table definitions)

## 6. Module Locations

- **Inventory:** `/server/routes/inventory.js`, `/server/services/inventoryService.js`
- **POS / Sales:** `/server/routes/sales`, Frontend: `/public/app.js`
- **Accounting (Reporting):** `/server/routes/accounting.js`
- **Accounting (Journal Insertion):** `/server/utils/accounting.js`
- **Treasury (Cash/Bank):** `/server/routes/treasury.js`
- **Tailoring:** `/server/routes/tailoring.js`, `/server/services/tailoringService.js`
- **Branch Management / Transfers:** `/server/routes/branches.js`
- **Manufacturing:** `/server/routes/manufacturing/`

## 7. Entry Points

- **Backend Server Entry Point:** `/server/server.js` (Calls `createApp()` from `/server/app.js`)
- **Frontend Entry Point:** `/public/index.html` (Loads `/public/app.js` which manages all client-side rendering routing).
