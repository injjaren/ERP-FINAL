\# SYSTEM ARCHITECTURE



This document defines the technical architecture of GROFIL ERP

and the future SaaS product SabraFlow.



The architecture must support:



\- Multi-company SaaS

\- Multi-branch operations

\- Offline capability

\- Real-time synchronization

\- Arabic and French interfaces



---



\# SYSTEM TYPE



The system is a Web-based ERP platform.



It must run on:



Desktop browsers  

Tablets  

Mobile devices  



The system should behave like a web application

but support offline work when the internet connection is unstable.



Technology recommended:



Progressive Web Application (PWA)



---



\# MULTI-TENANT STRUCTURE



The system must support multiple companies.



Each company operates independently.



Example:



Company 1: GROFIL  

Company 2: Atlas Sabra  

Company 3: Marrakech Threads  



Data separation is enforced using:



company\_id



All major tables must contain:



company\_id



Examples:



customers  

suppliers  

sales  

purchases  

inventory  

colors  



---



\# COMPANY STRUCTURE



Each company may have multiple branches.



Example:



Company: GROFIL



Branches:



Wholesale Sabra  

Retail Sabra  

Sewing Supplies  



Branch operations are independent.



Each branch has its own:



Customers  

Suppliers  

Inventory  

Sales  

Purchases  



---



\# BACKEND ARCHITECTURE



Recommended backend stack:



Node.js  

Express.js  



Responsibilities:



Business logic  

Authentication  

API services  

Data validation  

Accounting automation  



The backend exposes REST API endpoints.



---



\# DATABASE



Recommended database:



PostgreSQL



Reasons:



Reliability  

Scalability  

Strong relational structure  

Excellent SaaS support  



Key database features:



Foreign keys  

Indexes  

Transactions  



---



\# CORE DATABASE CONCEPTS



Multi-tenant separation using:



company\_id



Branch separation using:



branch\_id



Example structure:



sales

&nbsp; sale\_id

&nbsp; company\_id

&nbsp; branch\_id

&nbsp; customer\_id

&nbsp; total\_amount



inventory\_movements

&nbsp; movement\_id

&nbsp; company\_id

&nbsp; branch\_id

&nbsp; product\_id

&nbsp; quantity



---



\# FRONTEND ARCHITECTURE



Frontend should be built as a modern web interface.



Recommended technologies:



React

or

Vue



Responsibilities:



User interface  

Dashboards  

Charts  

POS interface  

Mobile-friendly layouts  



The frontend communicates with the backend via API.



---



\# OFFLINE CAPABILITY



The system must support offline operations.



Offline mode allows:



Sales entry  

Production recording  

Inventory movements  



Data is stored locally using:



IndexedDB



When the connection is restored:



Automatic synchronization occurs.



---



\# SYNCHRONIZATION SYSTEM



A background synchronization service must exist.



Responsibilities:



Upload offline transactions  

Download server updates  

Resolve conflicts  



Synchronization must be automatic.



---



\# AUTHENTICATION



Authentication system must include:



User accounts  

Role-based access control  



Roles may include:



Admin  

Manager  

Cashier  

Worker  



---



\# LANGUAGE SUPPORT



The system must support:



Arabic (RTL)

French (LTR)



Interface language must be switchable.



All labels and texts should use a translation system.



---



\# API DESIGN



All system operations must be exposed via API.



Examples:



/api/customers  

/api/sales  

/api/inventory  

/api/colors  

/api/production  



API must enforce:



company\_id filtering



---



\# SECURITY



The system must implement:



Secure authentication  

Role permissions  

Data isolation between companies  



No company should access another company's data.



---



\# DASHBOARDS



The system should provide advanced dashboards.



Examples:



Sales performance  

Production statistics  

Color demand analysis  

Worker productivity  

Low stock alerts  



AI agents may creatively design charts and visualizations.



Business rules must not be altered.



---



\# DESIGN PRINCIPLE



Business logic is fixed.



AI agents are free to improve:



User interface  

Visualizations  

Dashboard layouts  

User experience



---



# DUAL POS SYSTEM



The system operates two fundamentally different POS workflows.



Both coexist within the same ERP platform.



---



# POS_WHOLESALE



Handles retail thread sales and product distribution.



Customer flow:



Customer → Product Cart → Payment → Inventory Deduction



Cart model:



Cart = Products (sabra thread, accessories, supplies)



Selling units:



Kilogram (sabra wholesale)

Ounce (sabra retail)

Piece / Box (sewing supplies)



Inventory effect:



Immediate deduction on invoice confirmation.



---



# POS_TAILORING



Handles garment finishing orders and artisan service management.



Customer flow:



Customer → Order → Garments → Services → Artisan Jobs → Completion → Delivery



Order model:



Order

Lu Garment(s)

  Lu Services per Garment



Services include:



Sfifa

Akaad

Mraim

Trassan



Inventory effect:



Material-consuming services deduct inventory when marked DONE.



Integration points:



Shares the customer accounts system with POS_WHOLESALE.

Shares the color catalog with the wholesale and production systems.

Deducts inventory from the retail inventory stage.

Generates accounting entries for service revenue.



---



# POS SYSTEM COMPARISON



POS_WHOLESALE

  Sells physical products.

  Cart-based.

  Immediate inventory deduction.

  No artisan involvement.



POS_TAILORING

  Accepts garments for finishing.

  Order-Garment-Service hierarchy.

  Deferred inventory deduction (on service completion).

  Artisan job management required.
