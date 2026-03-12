# TAILORING SYSTEM

This document defines the tailoring order management system used in GROFIL ERP.

The tailoring module operates independently from the wholesale thread sales system.

Both modules coexist within the same ERP platform.

---

# BUSINESS FLOW

The tailoring workflow serves customers who bring garments and request finishing services.

Services include:

- Sfifa
- Akaad
- Mraim
- Trassan

The workflow follows this hierarchy:

Order
└ Garment(s)
  ├ Services per Garment
  └ Materials Used per Garment

Each service is assigned to an artisan.

Materials are recorded manually per garment by the operator.

---

# POS_TAILORING

Tailoring intake is handled through a dedicated POS interface called:

POS_TAILORING

This is separate from POS_WHOLESALE.

POS_TAILORING allows cashiers to:

- Select or create a customer
- Create a new tailoring order
- Add one or more garments to the order
- Assign services to each garment
- Confirm the order and generate artisan job assignments

---

# ORDER STRUCTURE

Each tailoring order contains:

- Customer reference
- Order date
- Status
- Total price
- Notes

An order may contain one or more garments.

Each garment contains one or more services AND one or more material records.

Example:

Order #001
└ Garment: Caftan Red
  ├ Services:
  │   ├ Sfifa — 4 meters
  │   ├ Akaad — 12 units
  │   └ Mraim — 1 unit
  └ Materials Used:
      ├ Sabra R205 → 10 qiyad
      └ Sewing Thread → 1 unit

---

# ORDER STATES

Tailoring orders pass through these states:

NEW

Order created. Services pending assignment.

IN_PRODUCTION

At least one service is in progress.

PARTIAL_READY

Some services completed, others still in progress.

READY

All services completed. Garment ready for pickup.

DELIVERED

Customer has collected the order and payment is settled.

---

# GARMENT REGISTRATION

When a garment is added to an order, the following information is recorded:

- Garment type (e.g., Caftan, Djellaba, Burnous)
- Color (linked to the color catalog)
- Quantity
- Notes
- Services requested
- Materials used (entered manually by the operator)

---

# SERVICES

Each garment service includes:

- Service type (from the service catalog)
- Quantity (meters, units, etc.)
- Unit price
- Assigned artisan
- Status

Service job states:

ASSIGNED — Artisan selected but not yet started.
IN_PROGRESS — Artisan is actively working.
DONE — Artisan has completed the service.

---

# SERVICE CATALOG

The service catalog defines available finishing services.

Each catalog entry contains:

- Service name (e.g., Sfifa, Akaad, Mraim)
- Default unit (meter, unit, piece)
- Base price

The catalog is company-level and shared across branches.

Note: The service catalog does NOT define material consumption.
Materials are recorded manually per garment in garment_materials.

---

# ARTISANS

Artisans are specialized workers who perform tailoring services.

Each artisan has:

- Name
- Phone
- Specialization (e.g., Sfifa, Akaad, General)
- Status (Active, Inactive)

Artisans are different from production workers.

Production workers process bobbins into thread.

Artisans provide finishing services on garments.

---

# ARTISAN JOB BOARD

The artisan job board is a screen that shows all assigned service jobs.

Jobs can be filtered by:

- Artisan
- Status
- Order date

Supervisors assign unassigned services to artisans.

Artisans or supervisors mark services as DONE when complete.

---

# GARMENT MATERIALS

Each garment may have one or more material records.

Materials are entered manually by the operator at the time of order intake.

Material consumption is NOT derived automatically from service catalog entries.

Each material record contains:

- product_id (the material used, e.g., Sabra thread, Sewing thread)
- color_id (the specific color variant, e.g., R205)
- quantity (how much is used)
- unit (e.g., qiyad, meter, piece, unit)

Example:

Garment: Caftan Red
└ Materials Used:
    ├ Sabra R205 → 10 qiyad
    └ Sewing Thread → 1 unit

These materials are associated with the garment, not with individual services.

Inventory deduction trigger:

When the garment is marked as completed (all services DONE),
the system records an inventory movement for each garment_materials entry.

Movement type: Garment Material Consumption

This deducts stock from the existing retail inventory.

---

# PRICING

Each service has a unit price defined in the service catalog.

Total price per service:

price = quantity × unit_price

Total order price = sum of all service prices.

The cashier may override individual service prices.

---

# PAYMENT

Payment is typically collected at delivery.

Payment options:

- Cash
- Partial Payment
- Credit

Customer balances are tracked in the same customer account system used by wholesale.

---

# INTEGRATION WITH WHOLESALE

Tailoring orders that consume sabra thread deduct inventory from:

- Retail Ounce Inventory
- OR Retail Kg Inventory

depending on quantity consumed.

This integrates POS_TAILORING with the existing inventory system without duplicating the inventory structure.

---

# TAILORING DASHBOARD

Dashboard indicators for tailoring operations:

- Orders received today
- Orders in production
- Orders ready for pickup
- Overdue orders
- Top artisans by completed services
- Most requested services

---

# DESIGN GOAL

The tailoring system must:

- Allow fast order intake through POS_TAILORING
- Track each garment with its services and materials independently
- Allow operators to manually enter materials used per garment
- Assign artisans to services efficiently
- Deduct materials from inventory when a garment is completed
- Provide full order history per customer
- Integrate with the existing inventory and accounting systems
