\# ERP SCREEN MAP



This document defines the screen structure of GROFIL ERP

and the SabraFlow SaaS platform.



The interface is organized by business functions,

not by branches.



Every operational screen includes a branch filter.



---



\# MAIN NAVIGATION STRUCTURE



Dashboard



Sales



Inventory



Production



Colors



Customers



Suppliers



Accounting



Reports



Settings



---



\# DASHBOARD



Purpose



Provide a real-time overview of the business.



Main widgets



Today's sales



Production today



Low stock alerts



Color demand trends



Branch performance



Inventory value



Recent payments



---



\# SALES



Handles all sales operations.



Screens



Sales Invoice List



Create Sales Invoice



Invoice Details



Customer Payment



Customer Account Statement



Features



Branch filter



Customer selection



Product selection



Multiple payment methods



Cash  

Cheque  

Bank Transfer  

TPE



---



\# INVENTORY



Manages stock across all branches.



Screens



Inventory Overview



Stock by Branch



Stock Movements



Manual Adjustment



Low Stock Alerts



Features



Branch filter



Color-based tracking



Bobines tracking



Kilogram tracking



Ounce tracking



Inventory history



---



\# PRODUCTION



Manages sabra production from bobines to retail units.



Screens



Production Sessions



Start Production Session



Active Sessions



Production History



Approve Production



Features



Worker selection



Color selection



Production quantity (kg)



Session approval



Inventory update after approval



---



\# COLORS



Central color catalog management.



Screens



Color Families



Color Shades



Color Inventory



Color Analytics



Features



Color family hierarchy



Hex color reference



Demand analysis



Color performance tracking



---



\# CUSTOMERS



Customer management.



Screens



Customer List



Customer Details



Customer Balance



Customer Transactions



Features



Branch customers



External customers



Customer credit tracking



Sales history



---



\# SUPPLIERS



Supplier management.



Screens



Supplier List



Supplier Details



Purchase History



Supplier Balance



Features



Purchase tracking



Supplier payment tracking



Cheque endorsement support



---



\# ACCOUNTING



Core accounting functions.



Screens



Journal Entries



General Ledger



Trial Balance



Balance Sheet



Profit and Loss



Cheque Portfolio



Features



Automatic accounting entries



Cheque lifecycle tracking



Customer balances



Supplier balances



---



\# REPORTS



Business analytics and operational reports.



Screens



Sales Reports



Inventory Reports



Production Reports



Customer Reports



Supplier Reports



Color Demand Reports



Branch Performance



Features



Date filters



Branch filters



Export options



PDF



Excel



---



\# SETTINGS



System configuration.



Screens



Company Profile



Branches



Users



Roles and Permissions



Company Settings



Features



Branch configuration



Multi-user management



Permission control



SaaS configuration options



---



\# BRANCH FILTER SYSTEM



All operational screens must support branch filtering.



Example



Sales → Branch = Wholesale



Inventory → Branch = Retail



Production → Branch = Workshop



This allows the system to operate across multiple branches

without duplicating screens.



---



\# DESIGN PRINCIPLE



The system must remain simple for shop operators.



Navigation must be clear and consistent.



Screens must prioritize operational speed

for real shop environments.



---



# TAILORING MODULE



The tailoring module is a dedicated section of the ERP

for managing garment finishing orders and artisan service jobs.



It coexists with the existing Sales, Inventory, and Production modules.



It is accessible from the main navigation as:



Tailoring



---



# TAILORING POS



The Tailoring POS screen is the main intake interface.



Purpose



Create a new tailoring order from a customer interaction.



Workflow



Select or create customer



Add one or more garments



Assign services to each garment



Review pricing



Confirm the order



Features



Fast customer search



Service catalog selection



Color picker integrated with color catalog



Order summary before confirmation



---



# ORDERS LIST



Purpose



Display all tailoring orders with their current status.



Filters



Status filter (NEW, IN_PRODUCTION, READY, DELIVERED)



Date range filter



Customer filter



Features



Quick status indicator per order



One-click access to Order Details



Highlight of overdue orders



---



# ORDER DETAILS



Purpose



Display full details of a single tailoring order.



Sections



Order header (customer, date, status, total)



Garments list



Services per garment with artisan assignments



Service job status indicators



Actions



Mark order as READY when all services are DONE



Mark order as DELIVERED



Print order summary



---



# GARMENTS MANAGER



Purpose



Add, edit, or remove garments within an order.



Fields



Garment type



Color selection from color catalog



Quantity



Notes



Services attached to the garment



---



# SERVICE CATALOG



Purpose



Manage the list of available finishing services.



Fields per catalog entry



Service name



Default unit



Base price



Production type (Material or Labor)



Features



Create, edit, deactivate services



View price history



---



# ARTISAN BOARD



Purpose



Supervisor view of all artisan service jobs.



Columns



Artisan name



Assigned services



In progress services



Completed today



Actions



Assign unassigned service to an artisan



Mark service as IN_PROGRESS or DONE



View artisan workload



---



# ARTISAN PROFILE



Purpose



View and edit individual artisan information.



Fields



Name



Phone



Specialization



Status (Active / Inactive)



Job history



Completed services count



Total earnings calculated from services



---



# TAILORING REPORTS



Added to the Reports module.



Tailoring Orders Report



Service Revenue by Type



Artisan Productivity Report



Order Pickup Status Report



Most Requested Services
