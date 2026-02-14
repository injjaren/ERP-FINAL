# CLAUDE.md - ERP Accounting System v3.0

## Project Overview

Arabic RTL ERP system for accounting, manufacturing, and inventory management. Built with Node.js/Express backend and vanilla JavaScript SPA frontend. Uses SQLite3 database with better-sqlite3.

## Quick Commands

```bash
npm start          # Production server on port 3000
npm run dev        # Development with nodemon auto-reload
docker-compose up  # Docker deployment
START.bat          # Windows quick start
```

## Project Structure

```
ERP-FINAL-v2.0/
├── server.js          # Main Express server (787 lines) - active version
├── server-base.js     # Extended server reference (2004 lines)
├── public/
│   ├── app.js         # Frontend SPA logic (1050 lines)
│   ├── index.html     # Main HTML with navigation
│   └── styles.css     # RTL Arabic styling
├── database/
│   └── accounting.db  # SQLite database
├── logs/              # Application logs
├── backups/           # Database backups
├── Dockerfile         # Docker config
├── docker-compose.yml # Docker compose
└── apply-fixes.js     # Migration utility
```

## Tech Stack

- **Backend**: Express.js 4.18, better-sqlite3 9.2, Helmet, CORS
- **Frontend**: Vanilla JS, HTML5, CSS3 (RTL)
- **Database**: SQLite3 with WAL mode
- **Node**: Requires >= 18.0.0

## Database Schema (Key Tables)

**Master Data**: clients, suppliers, partners, employees, artisans, warehouses, product_types, color_codes, service_types

**Inventory**: inventory (composite key: warehouse+product+color), inventory_movements

**Manufacturing**: manufacturing_orders, manufacturing_inputs, manufacturing_outputs, artisan_services, artisan_accounts

**Sales**: sales, sales_items, sales_payments, special_orders

**Purchases**: purchases, purchases_items, purchases_payments

**Financial**: checks_portfolio, checks_issued, treasury_ledger, expenses, opening_balances, profit_distributions

**System**: audit_log (complete change tracking)

## API Patterns

Base URL: `/api/`

Generic CRUD for all tables:
- `GET /api/{table}` - List records
- `POST /api/{table}` - Create record
- `PUT /api/{table}/:id` - Update record
- `DELETE /api/{table}/:id` - Delete record

Key specialized endpoints:
- `POST /api/pos/sale` - POS transaction
- `POST /api/inventory/movement` - Stock movement
- `POST /api/manufacturing/orders` - Production order
- `GET /api/dashboard` - KPIs and metrics
- `GET /api/reports/balance-sheet` - Financial position
- `GET /api/reports/income-statement` - P&L
- `GET /api/treasury/balance` - Cash/bank balance

## Code Conventions

**Auto-generated codes** (prefix + auto-increment):
- Clients: CLI1000+
- Suppliers: SUP2000+
- Colors: CLR3000+
- Warehouses: WH4000+
- Products: PRD5000+
- Services: SRV6000+
- Artisans: ART7000+

**Frontend patterns**:
- `api(endpoint, method, body)` - HTTP fetch wrapper
- `toast(message, type)` - Notifications
- `modal(title, content)` - Form dialogs
- `nav(page)` - Page routing
- `fmt(number)` - Format to Moroccan Dirham (DH)
- `fmtDate(date)` - Arabic date formatting

**Database patterns**:
- All dates stored as ISO strings
- Amounts stored as decimals
- Foreign keys enforced
- WAL mode for concurrent access

## Important Files

- `server.js:1-50` - Middleware setup and database initialization
- `server.js:100-200` - Generic CRUD endpoint handlers
- `server.js:300-500` - Specialized business logic endpoints
- `public/app.js:1-100` - API helper functions and utilities
- `public/app.js:200-400` - Dashboard and reporting logic
- `public/app.js:500-800` - CRUD page handlers
- `public/app.js:800-1050` - POS and manufacturing logic

## Testing

No automated tests. Manual testing via:
1. Run `npm run dev`
2. Open `http://localhost:3000`
3. Test CRUD operations through UI

## Common Tasks

**Add new entity type**:
1. Add table in `server.js` database initialization
2. Add API endpoints (or use generic CRUD)
3. Add frontend page in `app.js`
4. Add navigation link in `index.html`

**Add new report**:
1. Create SQL query in `server.js`
2. Add endpoint at `/api/reports/new-report`
3. Add UI component in `app.js`

**Modify database schema**:
1. Update table creation in `server.js`
2. Run server to apply (SQLite creates if not exists)
3. For migrations, use `apply-fixes.js` pattern

## Currency

All monetary values displayed in Moroccan Dirham (DH). Format: `X,XXX.XX DH`

## Language

UI is Arabic (RTL). Code comments and variables in English.
