-- LAGO Domain-brief 5/6 correction: what VISMA stores as the customer's
-- e-mail is the invoicing address, not a contact person. Rename the
-- column so the semantics are obvious across the codebase — the
-- per-contact e-mail lives on public.contacts.email_jsonb (populated by
-- the contact importer, brief 6).

ALTER TABLE public.companies_lago
    RENAME COLUMN email TO faktura_email;
