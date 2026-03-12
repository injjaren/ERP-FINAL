GROFIL ERP / SabraFlow Platform

Project Overview

Arabic RTL ERP system for accounting, manufacturing, and inventory management.

The system is currently used as an internal ERP prototype and is being expanded into a scalable platform called SabraFlow, a specialized ERP for Sabra thread production and distribution.

The application is built with:

- Backend: Node.js + Express
- Frontend: Vanilla JavaScript SPA
- Database: SQLite (better-sqlite3)

The system runs locally through a browser at:

http://localhost:3000

Future goal: transform the system into a multi-branch SaaS ERP platform while preserving the existing business logic.

---

Documentation

Additional system documentation is located in the "/docs" folder.

Claude must read all files inside "/docs" before making structural changes to the system.

These documents define the real business logic of the ERP.

The "/docs" folder includes specifications for:

- Inventory system
- Production system
- Color management
- Wholesale and retail logic
- Supplies management
- Accounting integration
- ERP screen structure
- Business workflows

Claude must treat these documents as the source of truth for system behavior.

---

Quick Commands

npm start
Production server on port 3000

npm run dev
Development server with nodemon auto reload

docker-compose up
Run system with Docker

START.bat
Windows quick start

---

Project Structure

ERP-FINAL-v2.0/

server.js
Main Express server

server-base.js
Extended server reference

public/
Frontend SPA

public/app.js
Frontend application logic

public/index.html
Main HTML

public/styles.css
RTL Arabic styling

database/
SQLite database storage

database/accounting.db

logs/
Application logs

backups/
Database backups

Dockerfile
Docker container configuration

docker-compose.yml
Docker environment

apply-fixes.js
Migration utility

docs/
System documentation used by Claude

---

Tech Stack

Backend
Express.js 4.18

Database
better-sqlite3 (SQLite)

Frontend
Vanilla JavaScript SPA

Security
Helmet
CORS

Node Version

«= 18»

---

Database Schema (Key Tables)

Master Data

clients
suppliers
partners
employees
artisans
warehouses
product_types
color_codes
service_types

Inventory

inventory
inventory_movements

Manufacturing

manufacturing_orders
manufacturing_inputs
manufacturing_outputs
artisan_services
artisan_accounts

Sales

sales
sales_items
sales_payments
special_orders

Purchases

purchases
purchases_items
purchases_payments

Financial

checks_portfolio
checks_issued
treasury_ledger
expenses
opening_balances
profit_distributions

System

audit_log

---

API Pattern

Base URL

/api/

Generic CRUD pattern

GET /api/{table}
List records

POST /api/{table}
Create record

PUT /api/{table}/:id
Update record

DELETE /api/{table}/:id
Delete record

Special endpoints

POST /api/pos/sale

POST /api/inventory/movement

POST /api/manufacturing/orders

GET /api/dashboard

GET /api/reports/balance-sheet

GET /api/reports/income-statement

GET /api/treasury/balance

---

Code Conventions

Auto generated codes

Clients
CLI1000+

Suppliers
SUP2000+

Colors
CLR3000+

Warehouses
WH4000+

Products
PRD5000+

Services
SRV6000+

Artisans
ART7000+

---

Frontend Patterns

api(endpoint, method, body)

toast(message, type)

modal(title, content)

nav(page)

fmt(number)

fmtDate(date)

---

Database Patterns

Dates stored as ISO strings

Amounts stored as decimal values

Foreign keys enforced

SQLite WAL mode enabled for concurrency

---

Currency

All financial values are displayed in Moroccan Dirham (DH)

Format example

1,250.00 DH

---

Language

User interface language
Arabic (RTL)

Source code
English

---

System Evolution

The ERP is being expanded toward a modular architecture.

Future goals include:

Multi branch support

SaaS deployment

Modular backend structure

Improved production tracking

Advanced inventory management

Analytics dashboards

The current system should be improved without breaking existing business logic.

---

Business Logic Protection

The ERP reflects real workflows used in Sabra thread production and distribution.

Claude may improve:

Code organization

System architecture

Performance

UI design

But must not change core business workflows defined in "/docs" unless explicitly instructed.

---

Development Notes

The current system is partially monolithic.

A future improvement path may include:

Splitting server.js into modules

inventory module

sales module

production module

accounting module

API separation

Improved frontend structure

However changes should be done gradually to avoid breaking functionality.

---

Testing

No automated tests exist yet.

Testing is manual:

Run npm run dev

Open http://localhost:3000

Test operations through UI

---

Important Note

Current database contains test data only.

Claude is free to modify the schema if necessary during development.