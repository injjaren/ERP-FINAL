\# INVENTORY SYSTEM



This document defines the inventory structure used in the GROFIL ERP system.



The system manages sabra thread stock across multiple stages of the

business workflow.



Inventory is organized based on \*\*material state\*\* and \*\*branch location\*\*.



---



\# INVENTORY STRUCTURE



Sabra thread inventory exists in four logical forms:



1 Raw Bobbins Inventory

2 Wholesale Kg Inventory

3 Retail Kg Inventory

4 Retail Ounce Inventory



Each stage represents a transformation in the product lifecycle.



---



\# RAW BOBBIN INVENTORY



Raw bobbins represent the raw material used for production.



Standard unit:



1 bobine = 1 kg



Raw bobbins are stored in the wholesale branch.



They are consumed during production sessions.



Production reduces raw bobbin stock.



Example movement:



Type: Production Consumption



-1 bobine



---



\# WHOLESALE KG INVENTORY



Wholesale inventory contains finished sabra thread in kilogram form.



This inventory receives stock from:



Production sessions.



Example movement:



Type: Production Output



+5 kg

Color: RED-102



Wholesale inventory sells thread to:



External customers



Retail branch



Important rule:



Wholesale → Retail movement is treated as a \*\*sale\*\*.



It is NOT treated as an internal transfer.



---



\# RETAIL KG INVENTORY



Retail branch maintains a kilogram storage area.



Retail purchases kilograms from the wholesale branch.



Example:



Retail buys:



5 kg

Color RED-102



Movement:



Wholesale Inventory



-5 kg



Retail Kg Inventory



+5 kg



Retail Kg Inventory is used to refill the shelves.



---



\# RETAIL OUNCE INVENTORY



Retail shelves contain sabra thread in ounces.



Retail customers buy thread in ounces.



Example:



Customer buys:



8 oz



System converts this to kg internally.



---



\# KG TO OUNCE CONVERSION



When shelves require new stock:



Retail converts kilograms into ounces.



Conversion rule:



1 kg = 32 oz



Example conversion:



-1 kg from Retail Kg Inventory

+32 oz to Retail Ounce Inventory



Movement type:



Conversion



---



\# COLOR CONSISTENCY



All inventories share the same color codes.



Example:



RED-102



The same color code is used in:



Production

Wholesale Inventory

Retail Kg Inventory

Retail Ounce Inventory



This ensures inventory traceability across the system.



---



\# INVENTORY MOVEMENT PRINCIPLE



Stock quantities must never be edited manually.



All stock changes occur through inventory movement records.



Movement types include:



Production

Sale

Purchase

Conversion

Adjustment



Each movement records:



Color Code

Quantity

Source

Destination

Date

Reference Document



---



\# MULTI-STAGE COLOR PRESENCE



The same color can exist simultaneously in multiple inventory stages.



Example:



Color RED-102



Raw Bobbins: 10

Wholesale Inventory: 25 kg

Retail Kg Inventory: 8 kg

Retail Ounce Inventory: 40 oz



The ERP must track each stage independently.



---



\# INVENTORY REPORTS



The system should provide the following reports:



Total stock by color



Stock by branch



Stock by inventory stage



Low stock alerts



Retail shelf refill suggestions



---



\# LOW STOCK ALERTS



Low stock thresholds should be configurable.



Example alerts:



0.5 kg



1 kg



1.5 kg



These alerts help identify colors that require production or purchase.



---



\# INVENTORY DASHBOARD



The inventory dashboard should display:



Total kilograms in wholesale



Total kilograms in retail storage



Total ounces on retail shelves



Low stock colors



Most consumed colors



---



\# INVENTORY DESIGN GOAL



The goal of this system is to maintain full traceability of sabra thread

across production, wholesale, and retail operations.



Every movement of thread must be recorded.



This ensures accurate reporting and prevents stock inconsistencies.

