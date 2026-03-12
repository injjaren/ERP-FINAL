\# COLOR SYSTEM



This document defines the color management system used in GROFIL ERP.



Sabra thread business relies heavily on color identification.



A strong color system is essential for:



Production

Inventory

Wholesale sales

Retail sales



The system must allow thousands of color shades while keeping

search and identification simple.



---



\# COLOR STRUCTURE



Colors are organized into two levels.



Level 1



Color Family



Level 2



Color Code (Shade)



Example:



Family: RED



Codes:



RED-MF101

RED-MF102

RED-MF103



This structure helps group similar shades together.



---



\# COLOR FAMILIES



Color families represent broad color categories.



Examples:



RED

BLUE

GREEN

YELLOW

WHITE

BLACK

GOLD

BROWN

BEIGE

ORANGE



Families are used for:



Shelf organization

Inventory grouping

Search filtering



---



\# COLOR CODE



Each color shade has a unique code.



Example:



RED-MF102



This code uniquely identifies the color across the system.



The same code must be used in:



Production

Wholesale inventory

Retail kilogram inventory

Retail ounce inventory



---



\# GLOBAL COLOR IDENTITY



Color codes are global.



Example:



RED-MF102 always refers to the same color.



No branch may create a different code for the same color.



This guarantees consistency across:



Production

Wholesale

Retail



---



\# COLOR STORAGE IN INVENTORY



The same color may exist simultaneously in multiple inventory stages.



Example:



Color RED-MF102



Raw Bobbins

Wholesale Kg Inventory

Retail Kg Inventory

Retail Ounce Inventory



The system must track quantities independently.



---



\# COLOR IN PRODUCTION



Production sessions always operate on a single color per combination.



Example workflow:



Worker receives:



4 combinations of color RED-MF102



Worker processes them sequentially.



Worker finishes RED-102 combinations before starting another color.



Mixing colors in the same jaab is not allowed.



---



\# COLOR IN WHOLESALE



Wholesale inventory stores colors in kilograms.



Example:



RED-MF102



Stock:



25 kg



Wholesale customers buy thread in kilogram units.



Possible quantities:



0.5 kg

1 kg

Multiple kilograms



---



\# COLOR IN RETAIL



Retail branch handles two forms of color inventory.



Retail Kg Inventory



Retail Ounce Inventory



Retail shelves contain ounces.



Example shelf quantity:



64 ounces



This equals:



2 kg



Retail staff refill shelves from Retail Kg Inventory.



---



\# COLOR SEARCH



The system must support fast color search.



Search methods:



Search by color code



Search by color family



Search by color name



Example queries:



RED



RED-MF102



---



\# COLOR VISUALIZATION



Each color may optionally store a HEX color value.



Example:



HEX: #C41E3A



This allows the ERP interface to display color previews.



Color swatches help users visually identify shades.



---



\# COLOR REPORTS



The system should generate the following reports:



Most sold colors



Least sold colors



Colors with low stock



Colors not sold recently



Production by color



---



\# COLOR DASHBOARD



The color dashboard should display:



Top selling colors



Colors close to stock depletion



Colors currently in production



Color distribution by family



---



\# COLOR DESIGN GOAL



The goal of the color system is to manage thousands of shades while

keeping color identification simple and consistent across all

branches and operations.

