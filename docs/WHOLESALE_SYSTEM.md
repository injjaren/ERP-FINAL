\# WHOLESALE SYSTEM



This document defines the wholesale trading system used in GROFIL ERP.



The wholesale branch sells sabra thread in kilogram units and supplies

both retail branches and external customers.



Wholesale operations are directly connected to inventory and accounting.



---



\# WHOLESALE SALE UNIT



Wholesale sales are performed using kilogram units.



Allowed quantities include:



0.5 kg  

1 kg  

1.5 kg  

2 kg  

2.5 kg  

3 kg  



Retail ounce units are not used in wholesale sales.



Ounce units are reserved for the retail branch only.



---



\# WHOLESALE INVENTORY SOURCE



Wholesale sales use the wholesale kilogram inventory.



Inventory sources include:



Production output  

Imported bobbins converted to sabra thread  



Production output is automatically added to wholesale kilogram inventory.



---



\# SALES INVOICE



All wholesale sales are recorded using sales invoices.



Each invoice includes:



Customer  

Invoice Date  

Color Code  

Quantity (kg)  

Unit Price  

Total Amount  



Invoices reduce wholesale inventory.



---



\# PAYMENT TYPES



Wholesale invoices may have three payment states.



1\) Full Payment



Invoice is fully paid immediately.



2\) Partial Payment



Customer pays part of the invoice.

Remaining amount becomes customer debt.



3\) Credit Sale



Invoice is fully unpaid.

Customer balance increases.



---



\# CUSTOMER BALANCE



The ERP system tracks customer balances.



Customer accounts include:



Total Purchases  

Total Payments  

Outstanding Balance  



Customers may pay debts later using various payment methods.



---



\# PAYMENT METHODS



Wholesale payments may be received using:



Cash  

Cheque  

Bank Transfer  

TPE (card payment)



Multiple payments may be applied to the same invoice.



Example:



Invoice: 2000 MAD



Payment 1: Cash 500  

Payment 2: Cheque 1000  

Payment 3: Transfer 500



---



\# CHEQUE MANAGEMENT



The system must manage cheque payments.



Cheque fields include:



Cheque Number  

Bank Name  

Amount  

Issue Date  

Due Date  

Customer  



Cheque status may be:



Received  

Deposited  

Cleared  

Returned



---



\# POST-DATED CHEQUES



Customers may issue post-dated cheques.



These cheques have future due dates.



The system must track:



Upcoming cheques  

Deposited cheques  

Cleared cheques  



---



\# THIRD-PARTY CHEQUES



Customers may provide cheques issued by third parties.



These are endorsed cheques.



The system must record:



Cheque Owner  

Cheque Issuer  

Received From Customer  



This allows proper traceability.



---



\# PROMISSORY NOTES (TRAITES)



The system must support promissory notes.



Promissory notes represent future payments.



Fields include:



Amount  

Due Date  

Customer  

Status  



Status may include:



Pending  

Collected  

Unpaid



---



\# INTER-BRANCH SALES



Transfers between branches are treated as sales.



Example:



Wholesale → Retail Branch



The wholesale branch issues a sales invoice.



Retail branch becomes a customer in the system.



This ensures accurate accounting and stock tracking.



---



\# WHOLESALE REPORTS



The ERP system should provide:



Daily sales report  

Customer balances report  

Outstanding debts report  

Cheque tracking report  

Promissory notes report  



---



\# WHOLESALE DASHBOARD



Wholesale dashboard indicators include:



Total sales today  

Total sales this week  

Total sales this month  

Top customers  

Outstanding receivables  

Incoming cheques  



---



\# SYSTEM OBJECTIVE



The wholesale system ensures:



Accurate inventory deduction  

Reliable debt tracking  

Secure cheque management  

Clear financial visibility for the business

