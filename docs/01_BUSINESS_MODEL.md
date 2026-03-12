Business Model Clarification



The system supports TWO fundamentally different business flows.



1\. Wholesale Sales



Wholesale operations sell physical products such as Sabra thread, bobines, and accessories.



Sales unit examples:



\- kilogram (kg)

\- pieces



Sales workflow:



Customer → POS Sale → Payment → Inventory deduction.



Cart model:



Cart = Products



Example:



Sabra Red R101 — 3kg

Bobine MF3001 — 2 pcs



Inventory is reduced immediately.



This flow is handled by:



POS\_WHOLESALE



---



2\. Retail Tailoring Orders



Retail customers bring garments and request finishing services.



Example services:



\- Sfifa

\- Akaad

\- Mraim

\- Trassan



A single garment may contain multiple services.



Example:



Garment: Caftan Red



Services:



\- Sfifa 4m

\- Akaad 12

\- Mraim 1



Hierarchy:



Order

└ Garment

└ Services



Services are assigned to artisans and processed through the Production system.



This flow is handled by:



POS\_TAILORING



---



Architectural Implication



The system must support two POS flows:



1\) POS\_WHOLESALE

&nbsp;  

&nbsp;  - Product based cart

&nbsp;  - Immediate inventory deduction



2\) POS\_TAILORING

&nbsp;  

&nbsp;  - Garment based workflow

&nbsp;  - Services assigned to artisans

&nbsp;  - Integrated with Production Jobs

