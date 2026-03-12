BRANCH ARCHITECTURE RULES

GROFIL ERP



This document defines the official architectural rules for branch isolation in the GROFIL ERP system.



The system operates with three independent branches:



1\. Wholesale Sabra

2\. Retail Sabra

3\. Sewing Supplies



All operational data must respect branch isolation unless explicitly defined as shared.



\---



1\. BRANCH ISOLATION PRINCIPLE



Every operational transaction in the system must belong to a specific branch.



All operational tables must include:



branch\_id



All API queries must enforce:



WHERE company\_id = ?

AND branch\_id = current\_branch



Branch data must never mix between branches.



\---



2\. USERS SYSTEM



Users are NOT shared between branches.



Each user belongs to a specific branch.



users table must include:



users.branch\_id



Rules:



• Wholesale employees → access Wholesale branch only

• Retail employees → access Retail branch only

• Sewing Supplies employees → access Supplies branch only



Exception:



The system owner / administrator may access all branches.



This is implemented through role permissions, not by removing branch\_id.



\---



3\. COLOR SYSTEM



The Color Catalog is shared only between:



• Wholesale Sabra

• Retail Sabra



The Sewing Supplies branch does not use the color system.



Shared color data includes only:



• color\_code

• color\_family

• shade

• color\_hex (if used)



These are defined in:



colors

color\_codes

color\_families

master\_colors



Important:



Color catalog sharing DOES NOT mean shared inventory.



\---



4\. COLOR INVENTORY



Inventory for colors is always branch-specific.



Example:



Color RED-MF102



Wholesale branch inventory:

45 kg



Retail branch inventory:

6 kg



Both reference the same color\_code, but quantities are stored per branch.



inventory tables must include:



branch\_id

color\_id

quantity



\---



5\. INTER-BRANCH SALES (WHOLESALE → RETAIL)



Wholesale sales do NOT automatically generate Retail purchases.



Only sales made specifically to the Retail branch trigger the automation.



Rule:



IF customer\_type = retail\_branch

THEN create retail purchase automatically.



Normal wholesale sales to external customers must remain standard sales.



\---



6\. CURRENT DATA STATE



All existing records currently belong to the Wholesale branch.



During branch isolation migration:



All historical records must be backfilled with:



branch\_id = Wholesale



This preserves existing accounting totals and test data integrity.



\---



7\. ACCOUNTING ISOLATION



Accounting transactions must be branch-specific.



journal\_entries must include:



branch\_id



All accounting reports must filter by branch:



• Ledger

• Trial Balance

• Profit \& Loss

• Balance Sheet



Each branch must see only its own financial activity.



\---



8\. TREASURY



Each branch must have its own treasury balance.



treasury tables must include:



branch\_id



Treasury screens must display only the current branch data.



\---



9\. WAREHOUSES



Warehouses belong to branches.



warehouses table must include:



branch\_id



Warehouse lists must always be filtered by the current branch.



\---



10\. MODULE VISIBILITY



Modules visible in the UI depend on branch type.



Wholesale Branch:



• Manufacturing

• Wholesale POS

• Inventory

• Purchases

• Suppliers

• Accounting



Retail Branch:



• Retail POS

• Tailoring POS

• Customers

• Inventory

• Treasury

• Accounting



Sewing Supplies Branch:



• Supplies POS

• Customers

• Suppliers

• Treasury

• Accounting



The Sewing Supplies branch must NOT display the Color System module.



\---



11\. DATA SAFETY RULE



No operation in the system may execute without a valid branch\_id.



Server middleware must enforce:



req.branch\_id must exist.



Requests without branch context must be rejected.



\---



These rules define the official multi-branch architecture of the GROFIL ERP system.

