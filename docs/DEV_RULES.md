\# DEVELOPMENT RULES



This document defines the development rules for the GROFIL ERP

and SabraFlow SaaS platform.



All developers and AI assistants must follow these rules.



---



\# GENERAL PRINCIPLES



The system must always reflect real business workflows.



Do not invent business logic that contradicts the documented workflow.



If uncertainty exists, follow the documentation files.



Core business rules are defined in:



CONTEXT.md  

SYSTEM\_OVERVIEW.md  

PRODUCTION\_SYSTEM.md  

INVENTORY\_SYSTEM.md  



---



\# MULTI COMPANY ISOLATION



The system is multi-tenant.



Every data table must include:



company\_id



No operation should access data outside its company.



All queries must enforce company\_id filtering.



---



\# BRANCH ISOLATION



Each branch operates independently.



Each branch has:



Separate inventory  

Separate cash register  

Separate customers  

Separate suppliers  



Inter-branch movement must be recorded as sales transactions.



Inventory transfers between branches are not allowed by default.



---



\# DATABASE RULES



Use PostgreSQL as the main database.



All tables must have:



id  

company\_id  

created\_at  

updated\_at  



Primary keys must be numeric or UUID.



Foreign keys must be enforced.



Do not store calculated values unless necessary for performance.



---



\# INVENTORY INTEGRITY



Inventory must only change through defined operations:



Purchase confirmation  

Production approval  

Sales confirmation  

Manual adjustment  



Direct modification of stock quantities is not allowed.



Inventory must always be traceable through movement records.



---



\# ACCOUNTING INTEGRITY



All financial operations must generate accounting entries.



The accounting model must be journal-based.



Core reports must always remain consistent:



General Ledger  

Trial Balance  

Balance Sheet  

Profit and Loss  



No operation should break accounting balance.



---



\# STATE MACHINE ENFORCEMENT



Operational documents must respect defined states.



Examples:



Invoices  

Production sessions  

Payments  

Cheques  



State transitions must follow the rules defined in:



WORKFLOW\_STATES.md



Invalid transitions must be blocked.



---



\# API DESIGN



Use RESTful API conventions.



Use predictable resource naming.



Example:



/api/customers  

/api/sales  

/api/production  



Use HTTP methods properly:



GET  

POST  

PUT  

DELETE  



All endpoints must validate:



company\_id  

branch\_id  

user permissions  



---



\# ERROR HANDLING



Errors must return clear responses.



Example:



Invalid state transition  

Missing inventory  

Unauthorized access  



Error responses should include meaningful messages.



---



\# SECURITY



All endpoints require authentication.



Sensitive operations must verify user permissions.



Users must only access their company data.



---



\# PERFORMANCE



Avoid unnecessary database queries.



Use indexes on frequently filtered fields.



Example:



company\_id  

branch\_id  

customer\_id  

supplier\_id  



Optimize heavy reporting queries.



---



\# DOCUMENTATION FIRST



Before implementing new functionality,

check if documentation already defines it.



If the behavior is unclear,

update documentation before writing code.



Documentation files are the source of truth.

