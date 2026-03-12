\# Current Development State



This document describes the current state of the GROFIL ERP system.



\---



\## Completed Architecture Changes



The system has recently migrated from company-level data to strict branch isolation.



All operational data is now separated using:



branch\_id



\---



\## Implemented Features



The following systems are already working:



✔ Branch login selection  

✔ Branch data isolation  

✔ Accounting isolation  

✔ Treasury separation per branch  

✔ Dashboard separation per branch  

✔ Inventory isolation per branch  



Historical data was assigned to:



Wholesale Sabra branch.



\---



\## Color System



The color catalog remains shared between:



Wholesale Sabra  

Retail Sabra



But inventory quantities are separate per branch.



Example:



Wholesale

RED-MF102 = 45 kg



Retail

RED-MF102 = 6 kg



\---



\## Branch Status



\### Wholesale Sabra

Operational.



Handles:

\- production

\- wholesale sales

\- color inventory



\---



\### Retail Sabra

Operational.



Handles:

\- retail POS

\- thread sales by ounce

\- inventory received from wholesale



\---



\### Sewing Supplies

Operational.



Handles:

\- sewing tools

\- no color system



\---



\## Current Development Focus



The current development phase is:



POS system improvements



Goals:



1\. Add color selection to POS

2\. Support color-based inventory

3\. Implement Wholesale → Retail automatic purchase generation



\---



\## Important Notes



Only sales directed to the Retail branch should trigger automatic purchase creation.



Normal wholesale customers must NOT trigger this automation.



\---



\## Next Development Step



Improve POS architecture to support:



color-based sales

branch-aware inventory

inter-branch transactions

