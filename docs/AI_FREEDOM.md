\# AI FREEDOM GUIDELINES



This document defines how AI assistants such as Claude Code

should behave when contributing to the GROFIL ERP and SabraFlow project.



The goal is to balance strict adherence to business logic

with freedom to improve technical implementation.



---



\# STRICT RULES (MUST NOT BE CHANGED)



AI must never change the core business logic defined in the documentation.



The following files define the business model and must be respected exactly:



CONTEXT.md  

SYSTEM\_OVERVIEW.md  

PRODUCTION\_SYSTEM.md  

INVENTORY\_SYSTEM.md  

COLOR\_SYSTEM.md  

WHOLESALE\_SYSTEM.md  

RETAIL\_SYSTEM.md  

SUPPLIES\_SYSTEM.md  



These files describe real-world workflows used in sabra trading.



AI must not invent alternative workflows that contradict them.



---



\# ACCOUNTING RULES



Accounting integrity is critical.



AI must follow the accounting structure defined in:



ACCOUNTING\_INTEGRATION.md



Every financial operation must generate consistent accounting entries.



AI must not bypass accounting rules.



---



\# STATE RULES



Operational states must follow:



WORKFLOW\_STATES.md



AI must not create undocumented states.



Example:



Invoice states must remain:



Draft  

Confirmed  

Partially Paid  

Paid  

Cancelled  



---



\# DATABASE RULES



Database structure must follow:



DATABASE\_SCHEMA.md



AI may extend the schema if needed,

but must not break existing relationships.



All tables must respect:



company\_id isolation  

branch isolation  



---



\# WHERE AI CAN BE CREATIVE



AI is allowed to improve the system in the following areas:



User interface design



Dashboard layouts



Data visualization



Performance optimizations



Code organization



API implementation details



Error handling



---



\# UI AND UX



AI is encouraged to improve the user interface.



Possible improvements include:



Better dashboards



Color indicators



Smart filters



Interactive charts



Mobile-friendly layouts



Dark mode support



RTL language support



---



\# PERFORMANCE OPTIMIZATION



AI may optimize queries, caching, and indexing.



Examples:



Improving reporting performance



Optimizing large color catalogs



Reducing database load



---



\# EXTENDING FEATURES



AI may propose new features if they respect the business model.



Examples:



Color demand analytics



Sales forecasting



Inventory alerts



Production efficiency metrics



---



\# SAAS EXPANSION



AI may extend the system for SaaS deployment.



Examples:



Subscription billing



Multi-company dashboards



Tenant management



Cloud deployment tools



---



\# WHEN IN DOUBT



If a conflict appears between code and documentation:



Documentation always wins.



AI should update the code to match documentation,

not the opposite.

