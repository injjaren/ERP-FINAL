\# PROJECT MAP



This project is an ERP system for Sabra thread production,

trading, and accounting management.



The system is currently used as a development prototype

for GROFIL ERP and will evolve into the SabraFlow SaaS platform.



---



\# SYSTEM ENTRY POINT



The backend server starts from:



server.js



This file contains the Express server and main API endpoints.



---



\# FRONTEND



The frontend is a single page application located in:



public/



Key files:



public/index.html  

public/app.js  

public/styles.css  



The frontend communicates with the backend via REST API.



---



\# DATABASE



The database is SQLite.



Location:



database/accounting.db



The database contains accounting, inventory,

manufacturing, and sales tables.



---



\# DOCUMENTATION



Detailed system documentation is located in:



docs/



Important documents include:



CONTEXT.md  

SYSTEM\_OVERVIEW.md  

DATABASE\_SCHEMA.md  

INVENTORY\_SYSTEM.md  

PRODUCTION\_SYSTEM.md  

COLOR\_SYSTEM.md  

WHOLESALE\_SYSTEM.md  

RETAIL\_SYSTEM.md  

SUPPLIES\_SYSTEM.md  

ACCOUNTING\_INTEGRATION.md  

ERP\_SCREEN\_MAP.md  



These documents define the business logic of the ERP.



Claude must read them before implementing changes.



---



\# CURRENT STATE



The system currently works as a monolithic Node.js server.



Future improvements may include:



\- Modular backend architecture

\- Improved inventory logic

\- Production workflow improvements

\- Multi-branch support

\- SaaS architecture



---



\# DEVELOPMENT PRINCIPLE



Claude must improve the system gradually.



Do not rewrite the entire system unless necessary.



Preserve working functionality whenever possible.

