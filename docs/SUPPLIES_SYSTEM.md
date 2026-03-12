\# SUPPLIES SYSTEM



This document defines the sewing supplies trading system used in GROFIL ERP.



The supplies branch sells sewing tools and accessories used by tailors

and traditional craft workers.



This inventory is separate from sabra thread inventory.



---



\# SUPPLIES PRODUCTS



Typical sewing supplies include:



Scissors

Needles

Zippers

Buttons

Thread spools

Tailoring accessories

Other sewing tools



Each product has its own SKU.



---



\# INVENTORY SEPARATION



Sewing supplies inventory is separate from sabra thread inventory.



Two inventory systems exist in the ERP:



Sabra Inventory  

Sewing Supplies Inventory  



This prevents mixing units such as:



kg

oz

pieces



\# BRANCH STRUCTURE



The sewing supplies activity operates as an independent branch

inside the GROFIL ERP system.



This branch has its own:



Suppliers  

Customers  

Inventory  

Sales transactions  

Purchases  



These records are separate from sabra production and sabra wholesale operations.



The branch shares the same ERP platform but maintains

independent operational data.



---



\# SALES UNITS



Supplies can be sold using two units.



Piece (individual item)



Box (multiple pieces)



Example:



Scissors → Piece  

Needles → Box  

Buttons → Box  

Zippers → Piece  



---



\# PRICING MODEL



Supplies products may have different prices depending on quantity.



Example pricing:



Retail price (per piece)



1 piece = 10 MAD



Wholesale price (per box or quantity)



10 pieces = 80 MAD



This allows retail and wholesale pricing.



---



\# SALES TRANSACTIONS



Sales are recorded using invoices.



Invoice fields include:



Customer

Product

Quantity

Unit

Unit Price

Total Amount



Inventory is reduced based on quantity sold.



---



\# PAYMENT TYPES



Supplies sales may be:



Cash

Partial Payment

Credit



Customer balances must be tracked.



Payments may be made later.



---



\# CUSTOMER TYPES



Typical customers include:



Tailors

Sfifa makers

Aakad makers

Traditional clothing craftsmen



Customers often purchase supplies together with sabra thread.



---



\# SUPPLIES DASHBOARD



The ERP system should provide:



Daily supplies sales

Top selling items

Low stock alerts

Customer balances



---



\# SYSTEM OBJECTIVE



The supplies system must provide:



Accurate stock tracking

Flexible pricing

Fast product sales

Integration with customer accounts

Separation from sabra inventory

