\# RETAIL SYSTEM



This document defines the retail sales system used in GROFIL ERP.



The retail branch sells sabra thread in ounce units to tailors

and traditional craft workers.



Retail operations rely on fast color identification and quick sales.



---



\# RETAIL SALE UNIT



Retail sales are performed using ounces.



Standard conversion:



1 kg = 32 ounces



Customers typically purchase multiple ounces.



Example purchases:



3 oz

5 oz

10 oz

20 oz



---



\# RETAIL PRICE



Retail price is fixed across all colors.



Example:



1 oz = 3 MAD



The system calculates invoice totals as:



Total = ounces × unit price



---



\# RETAIL INVENTORY STRUCTURE



Retail inventory has two levels.



Retail Kg Storage



This storage holds kilogram stock purchased from the wholesale branch.



Retail Shelf Inventory



This inventory holds ounces ready for sale.



---



\# KG TO OUNCE CONVERSION



Retail shelves are replenished using kilogram stock.



Conversion rule:



1 kg → 32 oz



Example movement:



Retail Kg Inventory



-1 kg



Retail Shelf Inventory



+32 oz



Movement type:



Conversion



---



\# COLOR ORGANIZATION



Retail shelves are organized by color family.



Example shelf groups:



Red shades

Blue shades

Green shades

Yellow shades

Black shades

White shades



Each color has a unique color code shared with the wholesale system.



---



\# RETAIL SALES



Retail sales are recorded using sales invoices.



Invoice fields include:



Customer

Color Code

Ounce Quantity

Unit Price

Total Amount



Retail sales reduce ounce inventory.



---



\# RETAIL PAYMENTS



Retail invoices may be:



Cash

Partial Payment

Credit



Customer balances must be tracked in the system.



---



\# RETAIL CUSTOMERS



Most retail customers are:



Tailors

Sfifa makers

Aakad makers

Traditional clothing craftsmen



Customers frequently return to purchase the same colors.



The system should allow quick customer selection.



---



\# RETAIL DASHBOARD



Retail dashboard indicators include:



Total sales today

Total sales this week

Total sales this month

Top selling colors

Low shelf colors



---



\# RETAIL SYSTEM OBJECTIVE



The retail system must provide:



Fast sales entry

Simple color search

Accurate ounce tracking

Customer balance tracking

Seamless integration with wholesale inventory

