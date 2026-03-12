\# WORKFLOW STATES



This document defines the operational states used in GROFIL ERP

and the SabraFlow SaaS platform.



Every operational document in the system passes through defined states.



This ensures consistent workflows and prevents invalid operations.



---



\# SALES INVOICE STATES



Sales invoices move through the following states.



Draft



The invoice is created but not confirmed.



Inventory is not affected.



Confirmed



The invoice is validated.



Inventory is reduced.



Accounting entries are generated.



Partially Paid



The customer has paid part of the invoice.



Remaining balance exists.



Paid



The invoice is fully settled.



Customer balance becomes zero.



Cancelled



The invoice was cancelled.



Inventory and accounting effects are reversed.



---



\# PURCHASE INVOICE STATES



Supplier purchases pass through the following states.



Draft



Purchase is recorded but not finalized.



Confirmed



Purchase is validated.



Inventory increases.



Supplier balance increases.



Partially Paid



Supplier received partial payment.



Paid



Supplier invoice fully paid.



Cancelled



Purchase cancelled.



Inventory and accounting entries reversed.



---



\# PAYMENT STATES



Payments may have the following states.



Pending



Payment recorded but not confirmed.



Confirmed



Payment validated.



Customer or supplier balance updated.



Cancelled



Payment reversed.



---



\# CHEQUE STATES



Cheques move through several states.



Received



Cheque received from customer.



Stored in cheque portfolio.



Deposited



Cheque deposited in bank.



Cleared



Cheque successfully collected.



Returned



Cheque bounced or rejected.



Endorsed



Cheque transferred to a supplier.



---



\# PRODUCTION SESSION STATES



Production sessions follow these states.



Open



Worker production session is active.



Production data may still be added.



Closed



Worker finished production.



Session ready for approval.



Approved



Supervisor confirms production.



Inventory is updated.



Cancelled



Production session voided.



---



\# INVENTORY MOVEMENT STATES



Inventory movements may be:



Pending



Movement created but not validated.



Confirmed



Inventory updated.



Reversed



Movement cancelled and stock restored.



---



\# USER ACCOUNT STATES



User accounts may have these states.



Active



User can access the system.



Suspended



User temporarily blocked.



Inactive



User disabled.



---



\# COMPANY STATES



For SaaS operation.



Active



Company can use the system.



Suspended



Access temporarily disabled.



Closed



Company account terminated.



---



# DESIGN PRINCIPLE



All operational entities must use defined states.



State transitions must be controlled by the system.



Invalid transitions must be prevented.



---



# TAILORING ORDER STATES



Tailoring orders pass through the following states.



NEW



Order created. No services started yet.



IN_PRODUCTION



At least one service job is in progress.



PARTIAL_READY



Some services completed. Others still in progress.



READY



All services completed. Order ready for customer pickup.



DELIVERED



Customer collected the order. Payment settled.



---



# TAILORING SERVICE JOB STATES



Each service within a tailoring order has its own state.



ASSIGNED



Artisan assigned but work not yet started.



IN_PROGRESS



Artisan is actively working on the service.



DONE



Service completed. Materials deducted from inventory if applicable.
