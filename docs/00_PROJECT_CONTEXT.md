IMPORTANT:

Always read this file before modifying the system.







\# GROFIL ERP — Project Context





\## Project Overview

GROFIL is a specialized ERP system designed for textile thread trading and tailoring services.



The system manages the full business workflow for Sabra thread trading, retail sales, and sewing supplies.



The ERP includes inventory, production tracking, sales, purchases, accounting, treasury, and POS systems.



\---



\## Business Structure



The system operates with three independent branches:



1\. Wholesale Sabra

2\. Retail Sabra

3\. Sewing Supplies



Each branch operates independently but within the same company.



\---



\## Branch Roles



\### Wholesale Sabra

Main supplier of Sabra thread.



Responsibilities:

\- Production and bobbin handling

\- Selling thread by kilogram

\- Supplying Retail branch

\- Managing color-based inventory



\---



\### Retail Sabra

Retail sales of Sabra thread.



Responsibilities:

\- Selling thread by ounce

\- Receiving inventory from Wholesale

\- Using the same color catalog as Wholesale



\---



\### Sewing Supplies

Retail store for sewing tools.



Responsibilities:

\- Selling sewing accessories

\- No color system

\- Independent inventory



\---



\## Color System



The color catalog is shared only between:



• Wholesale Sabra

• Retail Sabra



The Sewing Supplies branch does NOT use the color system.



Shared color information:



\- color code

\- color family

\- color shade



Inventory quantities remain separated per branch.



\---



\## Units



Wholesale sells thread by:



Kilogram



Retail sells thread by:



Ounce



Retail purchases thread from Wholesale in kilograms and sells it in ounces.



\---



\## Inter-Branch Sales



When Wholesale sells products to the Retail branch:



The system must automatically generate:



Retail Purchase Invoice



This preserves:



\- color codes

\- quantities

\- product references



This mechanism is used only when the customer is the Retail branch.



\---



\## System Architecture



The ERP is built with:



Backend:

Node.js



Database:

SQLite



Architecture principle:



Strict branch isolation using:



branch\_id



All operational data must belong to a branch.



\---



\## Important Rule



Before modifying the system always read:



ARCHITECTURE.md

BRANCH\_ARCHITECTURE\_RULES.md

