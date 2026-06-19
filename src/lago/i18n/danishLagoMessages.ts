// LAGO-specific Danish strings that live outside upstream's PartialCrmMessages
// shape — keyed under top-level `lago.*` so they cannot collide with
// upstream's `crm.*` / `resources.*` namespaces. Merged in lagoI18nProvider.

export const danishLagoMessages = {
  lago: {
    customer: {
      loading: "Henter kundedata...",
      visma_no: "VISMA-nr.",
      no_visma_no: "Intet VISMA-kundenummer endnu",
      segment: "Segment",
      visma_field_badge: "VISMA",
      visma_field_explanation:
        "Synkes fra VISMA når integrationen er live. Indtil da kan feltet ændres her.",
      sections: {
        core_info: "Kerne-info",
        last_visit: "Seneste besøg",
        open_followups: "Åbne opfølgninger",
        contacts: "Kontaktpersoner",
        recent_notes: "Seneste notater",
        purchase_history: "Købshistorik",
        crm_fields: "CRM-felter",
      },
      fields: {
        last_visit_at: "Seneste besøg",
        next_visit_planned: "Næste planlagte besøg",
        visma_customer_no: "VISMA-kundenummer",
        segment: "Segment (A/B/C)",
        segment_placeholder: "Vælg segment",
        opening_hours: "Åbningstider",
        opening_hours_placeholder: "fx Man-fre 09-17, lør 10-14",
      },
      empty: {
        no_open_tasks: "Ingen åbne opfølgninger.",
        no_contacts: "Ingen kontaktpersoner endnu.",
        no_notes: "Ingen notater endnu.",
        purchase_history_pending_visma:
          "Købshistorik kommer når VISMA-integrationen er aktiveret.",
      },
      actions: {
        mark_visited_today: "Marker besøgt i dag",
        save_crm_fields: "Gem CRM-felter",
      },
      errors: {
        bad_id: "Ugyldigt kunde-ID i URL'en.",
        load_failed: "Kunne ikke hente kunden.",
      },
      quick_note: {
        label: "Hurtig-notat på kunden",
        placeholder: "Hvad skete der i mødet? (gemmes med det samme)",
        submit: "Gem notat",
        save_failed: "Kunne ikke gemme notatet — prøv igen.",
        contact_label: "Om kontakt (valgfrit)",
        contact_none: "— ikke en specifik person —",
      },
      quick_task: {
        label: "Hvad er næste skridt?",
        placeholder: "fx Følge op på vareprøve",
        due_date: "Forfald",
        submit: "Tilføj opfølgning",
        save_failed: "Kunne ikke gemme opfølgningen — prøv igen.",
        needs_contact:
          "Tilføj først en kontaktperson på kunden — så kan du planlægge opfølgning herfra.",
      },
      note: {
        about_contact: "om %{name}",
      },
    },
    dashboard: {
      latest_notes_title: "Mine seneste notater",
      loading: "Henter notater...",
      load_failed: "Kunne ikke hente notater.",
      no_notes_yet: "Du har ikke skrevet nogen notater endnu.",
      unknown_company: "Ukendt kunde",
    },
  },
} as const;
