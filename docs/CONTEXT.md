\# CONTEXT



Project Name: GROFIL ERP  

Future SaaS Product: SabraFlow  



Industry:

Sabra Thread Production \& Distribution + Sewing Supplies Trade



Location:

Morocco (initial market)



Purpose:

Design a specialized ERP system for sabra thread production workshops,

wholesale distributors, and sewing supply stores.



The system models the real workflow used in Moroccan sabra production

and sewing supply trading.



---



\# BUSINESS STRUCTURE



The business consists of four operational environments:



1\) Production Workshop

2\) Wholesale Sabra Thread Branch

3\) Retail Sabra Thread Branch

4\) Sewing Supplies Shop (Wholesale + Retail)



Each environment has different inventory behavior and sales rules.



---



\# PRODUCTION WORKSHOP



Production uses raw bobbins to produce sabra thread.



Production flow:



Raw Bobbins → Production Session → Produced Thread → Wholesale Inventory



Workers process bobbins and convert them into sabra thread.



Production is organized in sessions.



Each worker opens a production session and records combinations processed.



---



\# CORE UNITS



1 bobine = 1 kilogram



Production uses combinations.



1 combination = 0.5 kg



Conversion units:



1 kilogram = 32 ounces



Retail selling unit = ounce  

Wholesale selling unit = kilogram



---



\# WORKER PRODUCTIVITY



Typical worker production per day:



Minimum:

30 kg



Average:

40 kg



Maximum:

50–60 kg depending on effort and working hours.



Worker wage:



6 MAD per kilogram produced.



---



\# PRODUCTION MATERIALS



Workers use small containers called:



Jaab (جعاب)



Jaab are reusable containers used during production.



Workers receive combinations and process them one by one.



Production rules:



Each jaab contains only ONE color.



Mixing colors inside one jaab is not allowed.



Worker must finish a combination before starting the next.



Workers usually keep a bag of jaab next to them and take new ones when needed.



Jaab are reused many times.



When customers accumulate enough used jaab they may sell them back to the workshop.



---



\# COLOR SYSTEM



Sabra thread colors are organized in color families.



Example families:



Red  

Blue  

Green  

Yellow  

White  

Gold  

Black  



Each color has:



Color Code  

Color Family  

Optional HEX color (for system UI)



Color codes must be shared across all branches.



---



\# INVENTORY STRUCTURE



There are three sabra inventories:



1\) Raw Bobbin Inventory

2\) Wholesale Thread Inventory

3\) Retail Thread Inventory



Raw Bobbins → used for production.



Production output → goes to Wholesale inventory.



Retail branch receives inventory from Wholesale branch.



Important rule:



Wholesale → Retail movement is treated as a SALE

(not as a stock transfer).



---



\# WHOLESALE SABRA SALES



Wholesale branch sells sabra thread in kilograms.



Typical quantities:



0.5 kg  

1 kg  

multiple kilograms



Customers may pay:



Cash  

Cheque  

Bank transfer  

TPE  

Partial payments  

Credit



Invoices may remain partially unpaid.



---



\# RETAIL SABRA SALES



Retail shop sells sabra thread by ounce.



Example:



Customer requests:



4 ounces  

8 ounces  

12 ounces  



Retail shelves usually hold:



2 kilograms per color (64 ounces).



Extra stock remains stored in kilogram form.



Retail converts kilograms into ounces for sale.



---



\# SEWING SUPPLIES SHOP



The sewing supplies branch sells:



Scissors  

Needles  

Thread cones  

Elastic  

Buttons  

Zippers  

Tailoring tools  

Various sewing accessories



This branch sells both:



Wholesale  

Retail



Units depend on product type:



Piece  

Box  

Meter  

Pack



Unlike sabra thread, these items do NOT use the ounce/kilogram system.



They follow standard product unit systems.



---



\# PAYMENT SYSTEM



Payment methods supported:



Cash  

Cheque  

Bank Transfer  

TPE  



Customers may:



Pay immediately  

Pay partially  

Pay later  



Suppliers follow the same payment possibilities.



---



\# ACCOUNTING INTEGRATION



Each transaction must generate accounting entries.



Example:



Sale



Debit:

Cash or Customer Receivable



Credit:

Sales Revenue



Purchase



Debit:

Inventory



Credit:

Supplier Payable



---



\# INVENTORY TRACKING RULE



Stock must never be edited manually.



All inventory changes must be recorded through

inventory movement records.



This allows:



Traceability  

Error detection  

Accurate stock history  



Movement types:



Production  

Sale  

Purchase  

Adjustment  



---



\# ERP DESIGN GOAL



Create a specialized ERP system adapted to:



Sabra thread production

Sabra wholesale trade

Sabra retail trade

Sewing supply stores



The system must support:



Production management  

Inventory tracking  

Wholesale operations  

Retail POS  

Accounting integration  

Color intelligence dashboards  



---



\# FUTURE VISION



The system may evolve into a SaaS product:



SabraFlow



Target market:



Sabra thread traders  

Textile workshops  

Sewing supply shops  



Initial deployment market:



Morocco


NOTE . ## Branch Architecture

GROFIL ERP operates as a multi-branch system.

Each branch functions as an independent operational unit with:

- its own customers
- its own suppliers
- its own inventory
- its own cash registers
- its own accounting flows

Branches can interact with each other through sales transactions,
but operational data remains separated by branch.

This design reflects the real structure of Sabra trading businesses,
where wholesale, retail, and supplies branches operate independently.

