\# API SPECIFICATION



This document defines the main API structure for GROFIL ERP

and the SabraFlow SaaS platform.



The backend exposes RESTful API endpoints used by the web interface.



All endpoints must enforce company data isolation using:



company\_id



---



\# AUTHENTICATION API



POST /api/auth/login



Authenticate user and return access token.



POST /api/auth/logout



Terminate user session.



GET /api/auth/me



Return current authenticated user.



---



\# COMPANY API



GET /api/company



Return company profile.



PUT /api/company



Update company information.



GET /api/company/settings



Return company configuration settings.



PUT /api/company/settings



Update company settings.



---



\# BRANCH API



GET /api/branches



List company branches.



POST /api/branches



Create new branch.



PUT /api/branches/{id}



Update branch.



DELETE /api/branches/{id}



Deactivate branch.



---



\# USER MANAGEMENT API



GET /api/users



List company users.



POST /api/users



Create user.



PUT /api/users/{id}



Update user.



DELETE /api/users/{id}



Disable user.



---



\# CUSTOMER API



GET /api/customers



List customers.



POST /api/customers



Create new customer.



GET /api/customers/{id}



Customer details.



PUT /api/customers/{id}



Update customer.



DELETE /api/customers/{id}



Deactivate customer.



---



\# SUPPLIER API



GET /api/suppliers



List suppliers.



POST /api/suppliers



Create supplier.



GET /api/suppliers/{id}



Supplier details.



PUT /api/suppliers/{id}



Update supplier.



DELETE /api/suppliers/{id}



Deactivate supplier.



---



\# COLOR MANAGEMENT API



GET /api/colors



List color catalog.



POST /api/colors



Create new color.



PUT /api/colors/{id}



Update color.



DELETE /api/colors/{id}



Deactivate color.



---



\# PRODUCT API



GET /api/products



List products.



POST /api/products



Create product.



PUT /api/products/{id}



Update product.



DELETE /api/products/{id}



Deactivate product.



---



\# INVENTORY API



GET /api/inventory



Get inventory levels per branch.



POST /api/inventory/adjust



Manual stock adjustment.



GET /api/inventory/movements



Inventory movement history.



---



\# SALES API



GET /api/sales



List sales invoices.



POST /api/sales



Create sales invoice.



GET /api/sales/{id}



Sales invoice details.



POST /api/sales/{id}/confirm



Confirm invoice.



POST /api/sales/{id}/cancel



Cancel invoice.



---



\# SALE ITEMS API



POST /api/sales/{id}/items



Add item to invoice.



PUT /api/sales/items/{id}



Update invoice item.



DELETE /api/sales/items/{id}



Remove invoice item.



---



\# PAYMENTS API



POST /api/payments



Register payment.



GET /api/payments



List payments.



GET /api/payments/{id}



Payment details.



---



\# CHEQUE API



GET /api/cheques



List cheque portfolio.



POST /api/cheques



Register cheque.



PUT /api/cheques/{id}/deposit



Deposit cheque.



PUT /api/cheques/{id}/clear



Mark cheque as cleared.



PUT /api/cheques/{id}/return



Mark cheque as returned.



PUT /api/cheques/{id}/endorse



Transfer cheque to supplier.



---



\# PURCHASE API



GET /api/purchases



List purchase invoices.



POST /api/purchases



Create purchase.



GET /api/purchases/{id}



Purchase details.



POST /api/purchases/{id}/confirm



Confirm purchase.



POST /api/purchases/{id}/cancel



Cancel purchase.



---



\# PRODUCTION API



GET /api/production/sessions



List production sessions.



POST /api/production/sessions



Create production session.



POST /api/production/sessions/{id}/close



Close session.



POST /api/production/sessions/{id}/approve



Approve session.



---



\# PRODUCTION OUTPUT API



POST /api/production/output



Register produced kilograms.



GET /api/production/output



Production history.



---



\# ACCOUNTING API



GET /api/accounting/journal



List journal entries.



GET /api/accounting/ledger



General ledger.



GET /api/accounting/trial-balance



Trial balance.



GET /api/accounting/balance-sheet



Balance sheet.



GET /api/accounting/income-statement



Profit and loss statement.



---



\# DASHBOARD API



GET /api/dashboard/sales



Sales dashboard.



GET /api/dashboard/inventory



Inventory dashboard.



GET /api/dashboard/production



Production dashboard.



GET /api/dashboard/colors



Color demand analytics.



---



# TAILORING ORDERS API



GET /api/tailoring/orders



List tailoring orders.



POST /api/tailoring/orders



Create a new tailoring order.



GET /api/tailoring/orders/{id}



Order details including garments and services.



POST /api/tailoring/orders/{id}/confirm



Confirm order. Creates service jobs.



POST /api/tailoring/orders/{id}/ready



Mark order as ready for pickup.



POST /api/tailoring/orders/{id}/deliver



Mark order as delivered.



POST /api/tailoring/orders/{id}/cancel



Cancel order.



---



# TAILORING GARMENTS API



POST /api/tailoring/orders/{id}/garments



Add a garment to an order.



GET /api/tailoring/garments/{id}



Garment details with services.



PUT /api/tailoring/garments/{id}



Update garment information.



DELETE /api/tailoring/garments/{id}



Remove garment from order.



---



# TAILORING SERVICES API



POST /api/tailoring/garments/{id}/services



Add a service to a garment.



GET /api/tailoring/services/{id}



Service details.



PUT /api/tailoring/services/{id}



Update service information.



PUT /api/tailoring/services/{id}/assign



Assign artisan to service.



PUT /api/tailoring/services/{id}/start



Mark service as IN_PROGRESS.



PUT /api/tailoring/services/{id}/complete



Mark service as DONE. Triggers inventory deduction if material type.



DELETE /api/tailoring/services/{id}



Remove service from garment.



---



# ARTISANS API



GET /api/artisans



List artisans.



POST /api/artisans



Create artisan.



GET /api/artisans/{id}



Artisan details.



PUT /api/artisans/{id}



Update artisan.



GET /api/artisans/{id}/jobs



Artisan service job history and current assignments.



---



# SERVICE CATALOG API



GET /api/tailoring/service-catalog



List all available services.



POST /api/tailoring/service-catalog



Create new service entry.



GET /api/tailoring/service-catalog/{id}



Service catalog entry details.



PUT /api/tailoring/service-catalog/{id}



Update service catalog entry.



DELETE /api/tailoring/service-catalog/{id}



Deactivate catalog entry.



---



# SECURITY PRINCIPLE



All endpoints must validate:



company_id

branch_id

user permissions



Users must not access data belonging to other companies.
