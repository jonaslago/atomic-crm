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
        open_followups: "Åbne opgaver",
        contacts: "Kontaktpersoner",
        recent_notes: "Seneste notater",
        purchase_history: "Købshistorik",
        sales_development: "Salgsudvikling",
        crm_fields: "CRM-felter",
        timeline: "Aktivitet",
        registration: "Registrér",
        next_step: "Næste skridt",
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
        no_open_tasks: "Ingen åbne opgaver.",
        no_contacts: "Ingen kontaktpersoner endnu.",
        no_notes: "Ingen notater endnu.",
        no_timeline: "Ingen aktivitet endnu.",
        purchase_history_pending_visma:
          "Købshistorik kommer når VISMA-integrationen er aktiveret.",
        // Brief 28 §4 (16. sep 2026): sætningen "afventer VISMA-sync"
        // var forældet — salgsdata er inde. Bruges nu kun som fallback
        // hvis panelet ikke er koblet til.
        sales_development_pending_visma:
          "Under opbygning — salgsdataene er indlæst.",
      },
      sales_development: {
        ytd_this_year: "ÅTD i år",
        ytd_last_year: "ÅTD sidste år",
        growth_kr: "Vækst",
        growth_pct: "Vækst %",
        full_last_year: "Hele sidste år",
        awaiting_sync: "Under opbygning",
      },
      timeline: {
        tab_all: "Alle",
        tab_notes: "Notater",
        tab_tasks: "Opgaver",
        tab_visits: "Besøg",
        visit_marker: "Besøgt",
        task_open: "Åben",
        task_done: "Færdig",
        full_contact_page: "Fuld kontaktdetalje →",
      },
      contact_status: {
        cold: "Cold",
        warm: "Warm",
        hot: "Hot",
        in_contract: "In Contract",
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
    activity: {
      added_company_note: "%{name} skrev et notat på",
      you_added_company_note: "Du skrev et notat på",
    },
    customer_list: {
      title: "Kunder",
      loading: "Henter kunder...",
      load_failed: "Kunne ikke hente kunder.",
      empty: "Ingen kunder matcher dine filtre.",
      search_placeholder: "Søg på navn, by eller kundenr…",
      filter_needs_visit: "Trænger til besøg",
      filter_mine: "Mine kunder",
      filter_district_label: "Distrikt",
      filter_district_all: "Alle distrikter",
      filter_sales_label: "Ansvarlig",
      filter_sales_all: "Alle sælgere",
      filter_visit_label: "Sidst besøgt",
      filter_visit_any: "Sidst besøgt: alle",
      filter_visit_never: "Aldrig besøgt",
      filter_visit_over_30: "Over 30 dage",
      filter_visit_over_60: "Over 60 dage",
      summary:
        "%{total} kunde |||| %{total} kunder · %{overdue} trænger til besøg · %{soon} snart",
      last_visit_today: "Besøgt i dag",
      last_visit_yesterday: "Besøgt i går",
      last_visit_n_days_ago: "Sidst besøgt for %{n} dage siden",
      never_visited_soft: "Endnu ikke besøgt",
      never_visited: "Aldrig besøgt",
      interval_n_days: "interval: hver %{n}. dag",
      sort: {
        name: "Sortér: Navn (A–Å)",
        // Brief 37 §4: samme kadence som Dagens — "trænger mest" er
        // priority → segment → navn, ikke bare "trænger til besøg"-boolean.
        priority: "Sortér: Trænger mest",
        last_visit: "Sortér: Seneste besøg først",
      },
      status: {
        // Brief 14 (rettelse): aldrig-besøgt A/B/C er rød "skal besøges".
        // Row-linjen "Endnu ikke besøgt" (never_visited_soft) forklarer
        // hvorfor — badge'en siger urgency.
        never_visited: "Skal besøges",
        overdue_by_n: "1 dag over |||| %{smart_count} dage over",
        soon: "Snart",
        on_plan: "Ajour",
        no_urgency: "Ingen data",
      },
      pagination: {
        page: "Side %{page} af %{total}",
        prev: "Forrige",
        next: "Næste",
        showing: "Viser %{from}–%{to} af %{total}",
        page_size: "Rækker pr. side",
      },
      preview: {
        title: "Preview",
        placeholder: "Vælg en kunde i listen for at se detaljer her.",
        open_full: "Åbn fuld side →",
        quick_actions: "Hurtige handlinger",
        mark_visited: "✓ Marker besøgt",
        add_note: "+ Notat",
        add_task: "+ Opgave",
        core_info: "Kerne-info",
        contacts: "Kontakter",
        sales_mini: "Salgsudvikling",
        bottom_sheet_label: "Kundepreview",
      },
    },
    dashboard: {
      todays_visits: "Dagens besøg",
      needs_visit: "Trænger til besøg (top 5)",
      tasks: "Opgaver",
      empty_visits: "Ingen planlagte besøg i dag.",
      empty_needs_visit: "Alle kunder er på plan.",
      empty_tasks: "Ingen åbne opgaver.",
      view_all: "Vis alle →",
    },
    sales_dev: {
      title: "Salgsudvikling",
      // Brief 28 §4 (16. sep 2026): "Read-only indtil VISMA-integrationen
      // er live" var forældet — salgsdata er inde. Skærmen selv er
      // stadig under opbygning (RAP-1/RAP-2 kommer efter felt-testen).
      subtitle:
        "Aggregerede tal per distrikt. Under opbygning — salgsdataene er indlæst.",
      top_growth: "Top 10 vækst",
      top_decline: "Top 10 fald",
      lost_customers: "Tabte kunder",
      new_customers: "Nye kunder",
      period_ytd: "ÅTD",
      period_3m: "Seneste 3 mdr.",
      district_all: "Alle distrikter",
      district_label: "Distrikt",
      // Samme rettelse — sætningen løj (data er der; widget er ikke bygget).
      empty_awaiting_visma: "Under opbygning — salgsdataene er indlæst.",
    },
    sync: {
      sales: {
        never: "Salgsdata ikke synkroniseret endnu",
        at: "Salgsdata pr. %{dato}",
        open_import:
          "Fakturaer bogført efter dette tidspunkt er ikke med. Opdateres ved import.",
      },
    },
    testdata: {
      banner:
        "Testdata — salgstallene er ikke gyldige og må ikke bruges til beslutninger.",
    },
    nav: {
      menu_open: "Åbn menu",
      home: "Hjem",
      felt: "Felt",
      felt_hint:
        "Sælger-fladen: Dagens · Søg · Kort. Backoffice-fanerne til højre bevares.",
      customers: "Kunder",
      contacts: "Kontakter",
      sales_dev: "Salgsudvikling",
      deals: "Aftaler",
      deals_muted_hint:
        "Aftaler-pipelinen er dæmpet i felt-testen — den er stadig tilgængelig her.",
      settings: "Indstillinger",
      settings_hint: "Admin-opsætning: intervaller, brugere, mapping.",
    },
    settings: {
      title: "Indstillinger",
      subtitle:
        "Admin-opsætning af felt-fladen og masterdata. Ændringer træder i kraft med det samme — sælgerne behøver ikke ny deploy.",
      admin_only:
        "Kun administratorer kan redigere disse indstillinger. Hvis du mangler adgang, kontakt Jonas.",
      not_admin:
        "Denne side er kun for administratorer. Sig til hvis du skal have adgang.",
      intervals: {
        section_title: "Besøgsintervaller",
        section_body:
          'Hvor ofte skal en A/B/C-kunde besøges? "Snart"-tærsklen bestemmer hvornår statusprikken bliver gul (fx 0.85 = de sidste 15 % af intervallet).',
        a_label: "Segment A (dage)",
        b_label: "Segment B (dage)",
        c_label: "Segment C (dage)",
        soon_label: "Snart-tærskel (0–1)",
        soon_hint:
          "En værdi på 0.85 betyder: kunden bliver gul når 85 % af intervallet er gået.",
        save: "Gem intervaller",
        saved: "Intervaller gemt — Dagens og kundelisten opdaterer straks.",
        save_failed: "Kunne ikke gemme intervallerne.",
        invalid: "Ugyldige værdier — intervaller skal være tal større end 0.",
      },
      sellers: {
        section_title: "Sælgere / brugere",
        section_body:
          'Én kanonisk liste over sælgere. Rækken med "har CRM-login" er koblet til en Supabase-bruger (via e-mail-match). En sælger uden login findes stadig som record — så "log på vegne af" virker indtil de får login.',
        header_full_name: "Navn",
        header_email: "E-mail",
        header_initials: "Init.",
        header_code: "VISMA-kode",
        header_title: "Titel",
        header_active: "Aktiv",
        header_login: "CRM-login",
        has_login: "Ja",
        no_login: "Nej",
        map_login: "Ret mapping",
        cancel: "Annullér",
        select_login: "Vælg CRM-bruger",
        no_login_option: "— intet login endnu —",
        row_saved: "Sælger opdateret.",
        save_failed: "Kunne ikke opdatere sælgeren.",
        toggle_active: "Skift aktiv/inaktiv",
        edit: "Redigér",
        active_count: "%{active} aktive · %{total} i alt · %{linked} med login",
        header_admin: "Admin",
        is_admin: "Admin",
        not_admin: "Bruger",
        no_login_dash: "—",
        toggle_admin: "Skift admin/bruger",
        admin_saved: "Adminstatus opdateret.",
        admin_last_error:
          "Kan ikke fjerne den sidste admin — mindst én skal beholde admin-rettigheder.",
      },
    },
    felt: {
      tabs: {
        kort: "Kort",
        dagens: "Dagens",
        soeg: "Søg",
      },
      kort: {
        lenses_label: "Linser",
        // Brief 17 (Nær mig-forenkling): ren recenter-handling.
        // Ingen toggle, ingen "Slå fra"-tilstand.
        near_me: "Nær mig",
        // Brief 17: separate beskeder for hver PositionError-kode så
        // sælgeren ved hvad der er galt. Toasts, ikke alert().
        near_me_geo_denied:
          "Placering blokeret. Tjek at browseren har lov til at bruge placering.",
        near_me_geo_unavailable:
          "Kunne ikke finde din placering — tjek at placering er slået til i browser/OS.",
        near_me_geo_timeout:
          "Det tog for lang tid at finde din placering. Prøv igen.",
        near_me_geo_generic:
          "Placering utilgængelig lige nu. Prøv igen om et øjeblik.",
        near_me_no_api:
          "Denne browser understøtter ikke placering. Brug telefonen eller Chrome/Safari.",
        near_me_no_hits:
          "Ingen kunder inden for 25 km — prøv at zoome ud eller ryd linserne.",
        loading: "Henter kort…",
        no_coords_hint:
          "%{missing} kunde har ikke kunnet geokodes og vises ikke på kortet.|||| %{missing} kunder har ikke kunnet geokodes og vises ikke på kortet.",
        showing: "Viser %{shown} af %{total} kunder",
        pin_close: "Luk",
        show_inactive: "Vis inaktive",
        show_leads: "Vis leads",
        legend_color: "Farve = besøg",
        legend_planned: "🕒 = planlagt besøg",
        legend_overdue: "Skal besøges",
        legend_soon: "Snart",
        legend_ontrack: "Ajour",
        legend_nodata: "Ingen data",
        callout_open: "Åbn",
        callout_planned_prefix: "Aftale",
        callout_no_next_visit: "Ingen aftale",
      },
      filters: {
        // Brief 14 (addendum 2): fælles panel på kort + Dagens.
        // Én regel: tomt = vis alle, hvert flueben snævrer ind.
        group_lenses: "Udvalg",
        group_visit: "Besøgsstatus",
        group_segment: "Segment",
        group_district: "Distrikt",
        group_sales: "Sælger",
        group_show_also: "Tag også med",
        // Brief 23 pkt 5: hvorfor tallene aendrer sig kontekst-foelsomt.
        counts_hint:
          "Tallene viser, hvor mange der kommer til, hvis du vælger dem.",
        // Brief 23 pkt 7: reglen for filtrene — usynlig i dag.
        rule_hint:
          "Tomt = alt vises. Flere valg i samme gruppe udvider. Valg i flere grupper snævrer ind.",
        clear: "Ryd filtre",
        mobile_button: "Filtre",
        mobile_sheet_title: "Filtrér kunder",
        mobile_apply: "Vis kunder",
        lenses: {
          planned: "Planlagte",
          planned_today: "Planlagt i dag",
        },
        visit: {
          must_visit: "Skal besøges",
          soon: "Snart",
          on_plan: "Ajour",
          no_urgency: "Ingen data",
        },
        show_also: {
          leads: "Leads",
          inactive: "Inaktive",
        },
      },
      dagens: {
        title_today: "I dag",
        lenses: {
          needs_now: "Trænger nu",
          planned_today: "Planlagt i dag",
          never_visited: "Aldrig besøgt",
        },
        sort: {
          most_overdue: "Sortér: Trænger mest",
          alpha: "Sortér: Navn (A–Å)",
          last_visit: "Sortér: Seneste besøg først",
        },
        empty_needs: "Ingen kunder trænger lige nu — alle er på plan 🎉",
        empty_all_lens: "Ingen kunder matcher linsen.",
        // Brief 24 §5: sikkerhedsnet mod bar tomskærm når sælger ikke
        // har fået tildelt kunder endnu.
        empty_mine_title: "Ingen kunder er tildelt dig endnu.",
        empty_mine_body:
          'Tildeling sker i VISMA. Slå "Mine kunder" fra for at se alle kunder — eller kontakt din administrator, hvis du mener, det er en fejl.',
        empty_mine_show_all: "Vis alle kunder",
        page_size_hint: "Viser %{n} af %{total}",
        // Brief 23 pkt 6: hvor mange kigger jeg pa. Naar filtrene er
        // uroerte, sig "alle" — saa er det tydeligt at der ikke er
        // filtreret endnu.
        count_showing: "Viser %{n} af %{filtered}",
        count_all: "Alle %{total} kunder",
        // Brief 85 §7 (28. sep 2026): tidligere tekst sagde "sorteret på
        // segment (A først), derefter navn" som om det var toppens sort-
        // regel. Toppen sorteres på STATUS (never_visited før overdue før
        // soon); segment+navn er kun tiebreak inden for en tied gruppe.
        // Hint fyrer når toppens vindue deler status+sortScore.
        sort_tie_hint:
          "Toppen deler status — inden for gruppen sorteres på segment (A først), derefter navn.",
      },
      card: {
        action_navigate: "Naviger",
        action_call: "Ring",
        action_register: "Registrér",
        action_plan: "Planlæg",
        action_open: "Åbn",
        note_quote_prefix: '"',
        note_quote_suffix: '"',
        no_note_yet: "Ingen noter endnu — start med første besøg.",
        no_phone: "Intet telefonnummer",
      },
      visit_toast: {
        saved: "Besøg registreret på %{name}",
        add_note: "Tilføj note",
        undo: "Fortryd",
      },
      soeg: {
        placeholder: "Søg på navn, by, kundenr…",
        keyboard_hint: "⌘K",
        scope_customers: "Kunder",
        scope_contacts: "Kontakter",
        scope_notes: "Noter",
        filters: "Filtre",
        table_view: "Vis som tabel",
        empty_hint: "Skriv navn, by eller kundenr. Prøv genvejene her:",
        shortcut_mine: "Mine kunder",
        shortcut_needs_visit: "Trænger til besøg",
        shortcut_never_visited: "Aldrig besøgt",
        results_customers: "%{n} kunde |||| %{n} kunder",
        results_contacts: "%{n} kontakt |||| %{n} kontakter",
        results_notes: "%{n} note |||| %{n} noter",
        no_results: 'Ingen resultater for "%{q}".',
        preview_placeholder: "Vælg et resultat for at se detaljer her.",
        preview_label: "Forhåndsvisning",
      },
    },
    registrer: {
      button: "Registrér",
      button_hint:
        "Registrér besøg, aktivitet, opgave eller løs note på kunden.",
      title: "Registrér på %{name}",
      tabs: {
        besoeg: "Besøg",
        aktivitet: "Aktivitet",
        opgave: "Opgave",
        note: "Note",
        planlaeg: "Planlæg",
      },
      besoeg: {
        date_label: "Dato",
        performed_by_label: "Udført af",
        note_label: "Hvad talte I om?",
        note_placeholder:
          "Fx: Snakkede Bordeaux 2022, Peter vil have samples inden uge 34.",
        submit: "Gem besøg",
        submit_and_plan: "Gem & planlæg næste",
      },
      aktivitet: {
        type_label: "Type",
        date_label: "Dato",
        performed_by_label: "Udført af",
        note_label: "Hvad skete der?",
        note_placeholder:
          "Fx: Fulgte op på Kimmle-tilbud pr. mail — venter svar.",
        submit: "Gem aktivitet",
      },
      opgave: {
        text_label: "Hvad skal du gøre?",
        text_placeholder: "Fx: Følge op på vareprøver.",
        type_label: "Type",
        due_label: "Forfald",
        assignee_label: "Tildelt til",
        submit: "Gem opgave",
        needs_contact:
          "Kunden mangler en kontaktperson — tilføj først en kontakt (via kundesiden) for at planlægge opgaver herfra.",
      },
      note: {
        text_label: "Løs note",
        text_placeholder: "Fx: De skifter kontaktperson fra oktober.",
        contact_label: "Om kontakt (valgfrit)",
        contact_none: "— ikke en specifik person —",
        submit: "Gem note",
        hint: "Bruges kun til noter der ikke hører til et konkret besøg eller aktivitet — ellers vælg Besøg eller Aktivitet.",
      },
      cancel: "Annullér",
      close: "Luk",
      empty_note_error: "Noten er tom — skriv hvad der skete.",
      save_failed: "Kunne ikke gemme — prøv igen.",
      toast: {
        besoeg: "Besøg registreret på %{name}",
        aktivitet: "%{type} registreret på %{name}",
        opgave: "Opgave tilføjet på %{name}",
        note: "Note gemt på %{name}",
      },
      activity_types: {
        opkald: "Opkald",
        smagning: "Smagning/Promotion",
        kampagne: "Kampagne",
        egen_henvendelse: "Egen henvendelse",
        andet: "Andet",
      },
    },
    plan_visit: {
      // Brief 15 · FS-20: skrive-siden for next_visit_planned.
      title_new: "Planlæg besøg på %{name}",
      title_edit: "Ret planlagt besøg på %{name}",
      description:
        'Sæt en dato (evt. tid + kort note) for næste besøg. Tænder planlagt-badgen og får kunden med i "Planlagte".',
      date_label: "Dato",
      time_label: "Tid (valgfri)",
      note_label: "Kort note (valgfri)",
      note_placeholder: "Fx: vis rosé-katalog, følg op på tilbud.",
      suggestion_hint: "Forslag: dagens dato + segment %{segment}-interval.",
      date_required: "Vælg en dato eller ryd planlægningen.",
      save: "Planlæg",
      cancel: "Annullér",
      clear: "Ryd planlægning",
      rail_button_new: "Planlæg besøg",
      rail_button_edit: "Ret planlagt besøg",
      rail_current: "Planlagt: %{when}",
      // Brief 85 tillæg §b (28. sep 2026): fanens indledning gør klart at
      // det er fremtid, ikke fortid — modalens titel "Registrér på …"
      // dækker ikke planlægning.
      tab_intro:
        "Planlæg fremtidigt besøg — dette registrerer ikke noget der er sket.",
    },
    contact: {
      title: "Kontakter",
      works_at: "Arbejder hos",
      no_company: "Ingen tilknyttet kunde",
      open_customer: "Åbn kunde →",
      section_identity: "Identitet",
      section_relation: "Relation",
      section_notes: "Notater",
      section_tasks: "Opgaver",
      section_details: "Detaljer",
      empty_email: "Ingen e-mail registreret",
      empty_phone: "Intet telefonnummer registreret",
      empty_title: "Ingen titel registreret",
    },
  },
} as const;
