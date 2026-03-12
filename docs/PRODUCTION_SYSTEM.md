\# PRODUCTION SYSTEM



This document defines the sabra thread production workflow used in GROFIL ERP.



Production converts raw bobbins into finished sabra thread that enters the

wholesale inventory.



The system reflects the real workflow used in sabra workshops.



---



\# PRODUCTION OVERVIEW



Production workflow:



Raw Bobbins

→ Production Session

→ Worker processes combinations

→ Produced sabra thread

→ Wholesale Kg Inventory



Production output always enters the wholesale kilogram inventory.



---



\# RAW MATERIAL



Production uses raw bobbins.



Standard unit:



1 bobine = 1 kilogram



Raw bobbins are stored in the wholesale branch.



They represent the raw material used for sabra production.



---



\# PRODUCTION UNIT



Production is organized using \*\*combinations\*\*.



Standard rule:



1 combination = 0.5 kg



Each processed combination produces:



0.5 kg of sabra thread.



Example:



10 combinations = 5 kg produced.



---



\# PRODUCTION CONTAINERS (JAAB)



Workers use containers called:



Jaab (جعاب)



Jaab hold sabra thread during production.



Rules:



Each jaab contains only ONE color.



Mixing colors inside a jaab is not allowed.



Worker must finish the current combination before starting another color.



Workers usually keep a bag of jaab next to them and take new ones when needed.



Jaab are reused many times.



Customers sometimes return used jaab and sell them back to the workshop.



---



\# PRODUCTION SESSIONS



Production is recorded using production sessions.



Each worker opens \*\*one production session per day\*\*.



Session contains:



Worker  

Start Time  

End Time  

Production Lines  



A session may contain multiple colors.



---



\# SESSION STATES



Production sessions have three states.



OPEN



Worker is currently producing.



Production lines can be added.



CLOSED



Worker finished working.



No new lines can be added.



APPROVED



Supervisor validates the session.



Production quantities become official.



---



\# PRODUCTION ENTRY



Currently:



Production data is entered by:



Supervisor  

or  

Computer Operator



Workers do not enter production data directly.



---



\# FUTURE MOBILE ENTRY



Future system design may allow:



Worker Mobile Production Entry.



Worker records production through mobile application.



Supervisor must still approve the session before confirmation.



---



\# PRODUCTION LINES



Each session contains production lines.



Each line represents a color produced.



Fields:



Color Code  

Number of Combinations  

Produced Quantity  



Formula:



Produced Quantity = combinations × 0.5 kg



Example:



8 combinations → 4 kg produced.



---



\# WORKER PRODUCTIVITY



Typical worker productivity:



Minimum:



30 kg per day



Average:



40 kg per day



Maximum:



50–60 kg depending on effort.



The system should track productivity per worker.



---



\# WORKER PAYMENT



Workers are paid based on produced kilograms.



Standard wage:



6 MAD per kg



Example:



Worker produced:



40 kg



Payment:



40 × 6 = 240 MAD



The ERP system calculates worker wages automatically.



---



\# SESSION CONTINUATION



Workers may stop production before finishing all combinations.



Unfinished work can be completed the next day.



A production session may remain OPEN until work is finished.



---



\# PRODUCTION OUTPUT



Produced sabra thread enters:



Wholesale Kg Inventory.



Example movement:



Color: RED-102



+5 kg



Source: Production Session



Movement Type:



Production



---



\# COLOR RULE



Production always occurs per color.



Workers process one color at a time.



Mixing colors inside the same jaab is strictly forbidden.



---



\# PRODUCTION REPORTS



The ERP system should generate:



Daily production report



Worker productivity report



Production by color



Monthly production statistics



---



\# PRODUCTION DASHBOARD



Production dashboard indicators:



Total production today



Total production this week



Total production this month



Top workers



Most produced colors



---



\# PRODUCTION DESIGN GOAL



The production system must provide:



Accurate worker tracking



Precise production quantities



Reliable wage calculation



Full traceability of produced thread



Seamless integration with inventory.



---



# TAILORING SERVICE JOBS



The production system is extended to handle tailoring service jobs.



Tailoring service jobs represent finishing work on garments.



This is separate from sabra thread manufacturing sessions.



Both types of production coexist inside the Production module.



---



# SERVICE JOB WORKFLOW



A tailoring service job is created when a service is confirmed in a tailoring order.



Workflow:



Service confirmed in POS_TAILORING



→ Service job created with status ASSIGNED



→ Artisan begins work → status IN_PROGRESS



→ Artisan or supervisor marks DONE



→ Order status updated



→ When all garment services are DONE:



  System deducts garment_materials from inventory



---



# SERVICE JOBS



All service jobs follow the same lifecycle regardless of service type.



Inventory consumption is NOT determined by the service type.



Inventory consumption is determined by the garment_materials entries

recorded manually by the operator at order intake.



---



# MATERIAL CONSUMPTION



Material consumption in the tailoring system is garment-based.



Materials are NOT derived from service catalog entries or service ratios.



Materials are entered manually by the operator per garment

during order intake and stored in the garment_materials table.



Deduction trigger:



When all services for a garment are marked DONE,

the system processes each garment_materials record

and records an inventory movement.



Movement type:



Garment Material Consumption



Example:



Garment: Caftan Red



garment_materials:

  Sabra R205 → 10 qiyad

  Sewing Thread → 1 unit



Inventory movements generated:

  -10 qiyad of Sabra R205

  -1 unit of Sewing Thread



Source: Retail Inventory

Type: Garment Material Consumption



This model gives operators full control over material quantities

without assuming fixed ratios based on service type.



---



# ARTISAN VS PRODUCTION WORKER



Production workers process raw bobbins into sabra thread.



Artisans perform finishing services on garments.



They are tracked separately in the system.



Production workers → production_sessions table



Artisans → artisans table



Both are reported under the Production module dashboard.
