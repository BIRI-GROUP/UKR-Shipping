# UKR portal data model

## PostgreSQL foundation

Phase 1 adds numbered migrations to the existing staff and Booking Lab schemas. Existing staff password records remain in `staff_users`; `users.staff_user_id` maps the authenticated identity. Passwords are not copied into a second authentication system. Existing customer mappings are preserved through explicit legacy identifiers.

New tables have UUID identifiers, created_at, updated_at, created_by and deleted_at metadata. Foreign keys specify deletion behaviour. Foreign-key, date, status and code indexes are created by the migration. Monetary values use NUMERIC(18,4) with a currency reference. Applied migration checksums are immutable. Audit and workflow histories reject modification and deletion.

## Identity and access

```mermaid
erDiagram
    staff_users ||--o| users : identity
    users ||--o| customers : identity
    users ||--o{ user_roles : assigned
    roles ||--o{ user_roles : grants
    roles ||--o{ role_permissions : contains
    permissions ||--o{ role_permissions : defines
    users ||--o{ user_warehouses : scope
    warehouses ||--o{ user_warehouses : limits
    users ||--o{ user_currencies : scope
    customers ||--o| customer_memberships : belongs
    customer_companies ||--o{ customer_memberships : authorises
    customer_companies ||--o{ customer_invitations : invites
    users ||--o{ sessions : authenticated
    users ||--o{ otp_codes : verifies
    users ||--o| user_preferences : customises
    themes ||--o{ user_preferences : uses
    users ||--o{ audit_log : acts
```

An email has one company membership. Company access is explicit: invitations, OTP verification and approved membership are separate controls. Matching an unverified domain or entering a VAT number does not authorise access.

## Shared operational and finance relationships

```mermaid
erDiagram
    companies ||--o{ invoices : issues
    currencies ||--o{ companies : base_currency
    services ||--o{ routes : offers
    routes ||--o{ purchase_rates : buying
    routes ||--o{ selling_rates : selling
    customer_companies ||--o{ selling_rates : negotiated
    customer_companies ||--o{ bookings : owns
    customers ||--o{ bookings : submits
    services ||--o{ bookings : configures
    bookings ||--o{ booking_items : cargo
    bookings ||--o{ booking_status_events : history
    bookings ||--o{ goods_in_receipts : receives
    warehouses ||--o{ goods_in_receipts : handles
    goods_in_receipts ||--o{ goods_in_photos : evidence
    consolidations ||--o{ consolidation_bookings : groups
    bookings ||--o{ consolidation_bookings : included
    consolidations ||--o{ shipments : transported
    bookings ||--o{ shipments : direct_leg
    shipments ||--o{ shipment_events : history
    files ||--o{ documents : stored
    bookings ||--o{ documents : attached
    bookings ||--o{ invoices : billed
    invoices ||--o{ invoice_lines : itemises
    tax_rates ||--o{ invoice_lines : tax
    invoices ||--o{ payments : settled
    payments ||--o{ payment_proofs : evidence
    payments ||--o{ receipts : acknowledged
    journal_entries ||--o{ journal_lines : posts
    accounts ||--o{ journal_lines : ledger
    accounts ||--o{ accounts : parent
    products_services ||--o{ products_services : parent
    purchase_invoices ||--o{ purchase_invoice_bookings : allocates
    bookings ||--o{ purchase_invoice_bookings : cost
```

## Shared controls and later service domains

```mermaid
erDiagram
    task_rules ||--o{ tasks : creates
    tasks ||--o{ task_comments : discussion
    approvals ||--o{ approval_steps : immutable_history
    exchange_rate_rules ||--o{ exchange_rates : validates
    email_templates ||--o{ email_outbox : renders
    mail_accounts ||--o{ mail_messages : imports
    customer_companies ||--o{ credit_lines : authorised
    customer_companies ||--o{ storage_contracts : contracts
    storage_contracts ||--o{ inventory_items : stores
    warehouses ||--o{ inventory_items : located
    fulfilment_orders ||--o{ fulfilment_order_items : selects
    inventory_items ||--o{ fulfilment_order_items : reserves
    trucks ||--o{ truck_documents : evidence
    drivers ||--o{ delivery_orders : assigned
    trucks ||--o{ delivery_orders : carries
    delivery_orders ||--o{ delivery_proofs : completed
    bookings ||--o{ feedback : reviews
    employees ||--o{ employee_documents : records
```

## What is active in Phase 1

Identity/session/OTP controls, approved company memberships, roles and permission matrix, master data, preferences, task rules and Task Center, approvals, exchange-rate controls, email template/outbox core and storage/backup abstractions.

Operational tables are reserved for the later phases in the final brief. Their existence is not a claim that shipment execution, accounting, fulfilment or fleet workflows are enabled. No rates, customer shipments, invoices, balances or staff passwords are fabricated or seeded. Each later phase must add its operational constraints and update this model.
