\# ACCOUNTING INTEGRATION



This document defines the accounting integration rules used in GROFIL ERP.



All business operations automatically generate accounting entries

in order to maintain accurate financial records.



The accounting system follows standard double-entry bookkeeping.



---



\# AUTOMATIC JOURNAL ENTRIES



All financial operations automatically generate journal entries.



Examples include:



Sales invoices

Purchase invoices

Customer payments

Supplier payments

Inventory movements



Users should not manually create accounting entries for normal operations.



---



\# SALES ACCOUNTING



When a sales invoice is created, the ERP system records:



Debit

Accounts Receivable (Customer)



Credit

Sales Revenue



If payment is received immediately:



Debit

Cash / Bank



Credit

Accounts Receivable



---



\# CUSTOMER PAYMENTS



Customer payments are applied to the customer account balance.



Payments are not linked to a specific invoice.



Example:



Customer Balance = 600 MAD



Customer Payment = 200 MAD



New Balance = 400 MAD



The system automatically applies payments to the oldest invoices.



---



\# PAYMENT METHODS



Customer payments may be received using:



Cash

Cheque

Bank Transfer

TPE



Multiple payments can be applied over time.



---



\# CHEQUE PORTFOLIO



Cheques received from customers are stored in a cheque portfolio.



Cheque states include:



Received

Deposited

Cleared

Returned



Portfolio cheques represent money not yet collected.



---



\# POST-DATED CHEQUES



Customers may issue post-dated cheques.



These cheques remain in the portfolio until their due date.



---



\# THIRD-PARTY CHEQUES



Customers may provide cheques issued by third parties.



These cheques can be endorsed to suppliers.



Example flow:



Customer gives cheque

Company endorses cheque to supplier



The system must track:



Cheque issuer

Cheque owner

Supplier receiving the cheque



---



\# SUPPLIER PAYMENTS



Supplier payments may be made using:



Cash

Cheque

Bank Transfer

Endorsed Customer Cheque



---



\# MULTIPLE CHEQUES FOR ONE DEBT



A supplier debt may be settled using multiple cheques.



Example:



Supplier Invoice = 10,000 MAD



Cheque 1 = 3,000

Cheque 2 = 3,000

Cheque 3 = 4,000



Each cheque may have a different due date.



---



\# BRANCH ACCOUNTING STRUCTURE



Each branch has separate accounting revenue tracking.



Examples:



Sales - Sabra Wholesale

Sales - Sabra Retail

Sales - Sewing Supplies



This allows financial analysis per branch.



---



\# ACCOUNTING REPORTS



The ERP system must generate:



General Ledger

Trial Balance

Balance Sheet

Income Statement

Customer Balances

Supplier Balances

Cheque Portfolio Report



---



\# SYSTEM OBJECTIVE



The accounting system ensures:



Automatic financial recording

Accurate debt tracking

Cheque management

Supplier payment tracking

Financial transparency across branches

