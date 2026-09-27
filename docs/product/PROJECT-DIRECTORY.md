# UKR Project Directory

This is the repository source of truth for the UKR Trade & Logistics OS.

## Product vision
Build a UAE-centered trade and logistics platform covering inquiry, qualification, quote, booking, China operations, LCL/FCL/Air/DDP, customs, trucking, delivery, documents, finance, feedback and KPI reporting.

## Surfaces
1. Public website
2. Customer portal
3. Staff backend
4. Partner portal later

## Non-negotiables
- Preserve useful existing URLs wherever practical.
- Keep the homepage simple.
- WordPress remains the public CMS/SEO layer.
- The logistics operating system is a separate application.
- One immutable UKR Shipment ID connects the full record.
- Never expose internal cost/margin/private notes to customers.
- Normal expansion of routes/services/master data must be admin-configurable.
- Route availability supports ONLINE RATE, STAFF-CONFIRM, REQUEST ONLY, TEMPORARILY SUSPENDED and UNAVAILABLE.
- Production release requires staging UAT and security/access tests.

## Build order
1. Website/URL audit
2. Service catalog and route matrix
3. Database/master data
4. Authentication/users/permissions
5. CRM
6. Rates/quotes/PDF
7. Booking engine
8. Shipment lifecycle
9. China + LCL/FCL/Air/DDP
10. Staff Control Tower
11. Customer Portal
12. Fleet/dispatch
13. Finance
14. SmartLoad
15. Calculators
16. Notifications
17. Public redesign
18. Integrations
19. KPI/reporting/feedback
20. UAT/security/release
