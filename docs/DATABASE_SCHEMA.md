\# DATABASE SCHEMA



This document defines the main database structure for GROFIL ERP

and the future SabraFlow SaaS platform.



The database is designed for PostgreSQL.



All data is separated using:



company\_id



Branches operate independently using:



branch\_id



---



\# COMPANIES



companies



company\_id (PK)

company\_name

created\_at



---



\# BRANCHES



branches



branch\_id (PK)

company\_id (FK)

branch\_name

branch\_type



Example types:



Wholesale

Retail

Supplies



---



\# USERS



users



user\_id (PK)

company\_id (FK)

username

password\_hash

role

branch\_id



---



\# CUSTOMERS



customers



customer\_id (PK)

company\_id (FK)

branch\_id (FK)

customer\_name

phone

balance



---



\# SUPPLIERS



suppliers



supplier\_id (PK)

company\_id (FK)

branch\_id (FK)

supplier\_name

phone

balance



---



\# COLORS



colors



color\_id (PK)

company\_id (FK)

color\_code

color\_family

color\_name\_ar

color\_name\_fr



---



\# PRODUCTS



products



product\_id (PK)

company\_id (FK)

product\_name

product\_type



Examples:



Sabra Thread

Sewing Supply



---



\# INVENTORY



inventory



inventory\_id (PK)

company\_id (FK)

branch\_id (FK)

product\_id (FK)

quantity



---



\# INVENTORY MOVEMENTS



inventory\_movements



movement\_id (PK)

company\_id (FK)

branch\_id (FK)

product\_id (FK)

movement\_type



Examples:



Purchase

Sale

Production

Adjustment



quantity

created\_at



---



\# SALES



sales



sale\_id (PK)

company\_id (FK)

branch\_id (FK)

customer\_id (FK)

total\_amount

payment\_status

created\_at



---



\# SALE ITEMS



sale\_items



sale\_item\_id (PK)

sale\_id (FK)

product\_id (FK)

quantity

unit\_price



---



\# PURCHASES



purchases



purchase\_id (PK)

company\_id (FK)

branch\_id (FK)

supplier\_id (FK)

total\_amount

created\_at



---



\# PURCHASE ITEMS



purchase\_items



purchase\_item\_id (PK)

purchase\_id (FK)

product\_id (FK)

quantity

unit\_cost



---



\# PAYMENTS



payments



payment\_id (PK)

company\_id (FK)

branch\_id (FK)

payment\_type



Examples:



Cash

Cheque

Bank Transfer

TPE



amount

created\_at



---



\# CHEQUES



cheques



cheque\_id (PK)

company\_id (FK)

cheque\_number

issuer\_name

amount

due\_date

status



Examples:



Received

Deposited

Cleared

Returned



---



\# PRODUCTION SESSIONS



production\_sessions



session\_id (PK)

company\_id (FK)

branch\_id (FK)

worker\_id

session\_date



---



\# PRODUCTION OUTPUT



production\_output



output\_id (PK)

session\_id (FK)

color\_id (FK)

kilograms\_produced



---



\# ACCOUNTING ENTRIES



journal\_entries



entry\_id (PK)

company\_id (FK)

entry\_date

description



---



\# JOURNAL ENTRY LINES



journal\_lines



line\_id (PK)

entry\_id (FK)

account\_id

debit

credit



---



\# ACCOUNTS



accounts



account\_id (PK)

company\_id (FK)

account\_name

account\_type



Examples:



Asset

Liability

Revenue

Expense



---



# TAILORING MODULE TABLES



The following tables support the POS\_TAILORING workflow.



They are additive to the existing schema and do not alter any existing tables.



---



# TAILORING ORDERS



tailoring\_orders



id (PK)

company\_id (FK)

branch\_id (FK)

customer\_id (FK → customers)

order\_date

status



Examples:



NEW

IN\_PRODUCTION

PARTIAL\_READY

READY

DELIVERED



total\_price

notes



---



# TAILORING GARMENTS



tailoring\_garments



id (PK)

order\_id (FK → tailoring\_orders)

garment\_type



Examples:



Caftan

Djellaba

Burnous



color\_id (FK → colors)

quantity

notes



---



# TAILORING SERVICES



tailoring\_services



id (PK)

garment\_id (FK → tailoring\_garments)

service\_type



Examples:



Sfifa

Akaad

Mraim

Trassan



quantity

price

artisan\_id (FK → artisans)

status



Examples:



ASSIGNED

IN\_PROGRESS

DONE



---



# GARMENT MATERIALS



garment\_materials



id (PK)

garment\_id (FK → tailoring\_garments)

product\_id (FK → products)

color\_id (FK → colors)

quantity

unit



Examples:



qiyad

meter

piece

unit



Material records are entered manually by the operator during order intake.



Inventory is deducted when the garment is completed.



Movement type:



Garment Material Consumption



---



# SERVICE CATALOG



service\_catalog



id (PK)

company\_id (FK)

name



Examples:



Sfifa

Akaad

Mraim

Trassan



unit



Examples:



meter

unit

piece



base\_price

Note: production\_type has been removed.

Material consumption is recorded manually in garment\_materials.

The catalog does not control inventory deduction.



---



# ARTISANS



artisans



id (PK)

company\_id (FK)

branch\_id (FK)

name

phone

specialization



Examples:



Sfifa

Akaad

General



status



Examples:



Active

Inactive
