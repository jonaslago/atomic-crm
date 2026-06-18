import type { PartialCrmMessages } from "./englishCrmMessages";

// Danish translations for the LAGO CRM shell (navigation, settings, auth,
// common labels). Domain-specific field labels intentionally fall back to
// English for now — those will be re-modelled before MoSCoW translation work.
export const danishCrmMessages: PartialCrmMessages = {
  resources: {
    companies: {
      name: "Virksomhed |||| Virksomheder",
      forcedCaseName: "Virksomhed",
      empty: {
        description: "Din virksomhedsliste er tom.",
        title: "Ingen virksomheder fundet",
      },
      action: {
        create: "Opret virksomhed",
        edit: "Redigér virksomhed",
        new: "Ny virksomhed",
        show: "Vis virksomhed",
      },
      added_on: "Tilføjet %{date}",
      followed_by: "Fulgt af %{name}",
      followed_by_you: "Fulgt af dig",
      no_contacts: "Ingen kontakter",
      nb_contacts: "%{smart_count} kontakt |||| %{smart_count} kontakter",
      nb_deals: "%{smart_count} aftale |||| %{smart_count} aftaler",
      autocomplete: {
        create_error: "Der opstod en fejl ved oprettelse af virksomheden",
        create_item: "Opret %{item}",
        create_label: "Skriv for at oprette en ny virksomhed",
      },
      filters: {
        only_mine: "Kun mine virksomheder",
      },
    },
    contacts: {
      name: "Kontakt |||| Kontakter",
      forcedCaseName: "Kontakt",
      action: {
        add: "Tilføj kontakt",
        add_first: "Tilføj din første kontakt",
        create: "Opret kontakt",
        edit: "Redigér kontakt",
        export_vcard: "Eksportér til vCard",
        new: "Ny kontakt",
        show: "Vis kontakt",
      },
      background: {
        last_activity_on: "Seneste aktivitet %{date}",
        added_on: "Tilføjet %{date}",
        followed_by: "Fulgt af %{name}",
        followed_by_you: "Fulgt af dig",
        status_none: "Ingen",
      },
      empty: {
        description: "Din kontaktliste er tom.",
        title: "Ingen kontakter fundet",
      },
      filters: {
        search: "Søg navn, virksomhed...",
        today: "I dag",
        this_week: "Denne uge",
        managed_by_me: "Mine kontakter",
        tags: "Tags",
        tasks: "Opgaver",
      },
      import: {
        title: "Importér kontakter",
        button: "Importér CSV",
        complete:
          "Import gennemført. %{importCount} kontakter importeret med %{errorCount} fejl",
        progress:
          "Importeret %{importCount} / %{rowCount} kontakter med %{errorCount} fejl.",
        error:
          "Kunne ikke importere filen — kontrollér at det er en gyldig CSV-fil.",
        imported: "Importeret",
        remaining_time: "Estimeret resterende tid:",
        running: "Import i gang — undlad at lukke fanen.",
        sample_download: "Hent CSV-skabelon",
        sample_hint: "Her er en CSV-skabelon du kan bruge som udgangspunkt",
        stop: "Stop import",
        csv_file: "CSV-fil",
        contacts_label: "kontakt |||| kontakter",
      },
    },
    deals: {
      name: "Aftale |||| Aftaler",
      action: {
        back_to_deal: "Tilbage til aftalen",
        create: "Opret aftale",
        new: "Ny aftale",
      },
      updated: "Aftale opdateret",
      empty: {
        before_create: "før du opretter en aftale.",
        description: "Din aftaleliste er tom.",
        title: "Ingen aftaler fundet",
      },
      invalid_date: "Ugyldig dato",
    },
    notes: {
      name: "Notat |||| Notater",
      forcedCaseName: "Notat",
      action: {
        add: "Tilføj notat",
        add_first: "Tilføj dit første notat",
        delete: "Slet notat",
        edit: "Redigér notat",
        update: "Opdatér notat",
        add_this: "Tilføj dette notat",
      },
      deleted: "Notat slettet",
      empty: "Ingen notater endnu",
      author_added: "%{name} tilføjede et notat",
      you_added: "Du tilføjede et notat",
      me: "Mig",
      added: "Notat tilføjet",
      inputs: {
        add_note: "Tilføj et notat",
        options_hint: "(vedhæft filer eller redigér detaljer)",
        show_options: "Vis indstillinger",
      },
      stepper: {
        hint: "Åbn en kontakt og tilføj et notat",
      },
    },
    sales: {
      name: "Bruger |||| Brugere",
      action: {
        new: "Ny bruger",
      },
    },
    tasks: {
      name: "Opgave |||| Opgaver",
      forcedCaseName: "Opgave",
      action: {
        add: "Tilføj opgave",
        create: "Opret opgave",
        edit: "Redigér opgave",
      },
      added: "Opgave tilføjet",
      deleted: "Opgave slettet",
      empty: "Ingen opgaver endnu",
      empty_list_hint: "Opgaver knyttet til dine kontakter vises her.",
      filters: {
        later: "Senere",
        overdue: "Forsinkede",
        this_week: "Denne uge",
        today: "I dag",
        tomorrow: "I morgen",
        with_pending: "Med åbne opgaver",
      },
      updated: "Opgave opdateret",
    },
    tags: {
      name: "Tag |||| Tags",
      action: {
        add: "Tilføj tag",
        create: "Opret nyt tag",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Nulstil adgangskode",
    },
    auth: {
      first_name: "Fornavn",
      last_name: "Efternavn",
      confirm_password: "Bekræft adgangskode",
      confirmation_required:
        "Følg linket vi har sendt til dig på mail for at bekræfte din konto.",
      recovery_email_sent:
        "Hvis du er en registreret bruger, modtager du snart en mail om nulstilling af adgangskode.",
      sign_in_failed: "Log ind mislykkedes.",
      sign_in_google_workspace: "Log ind med Google Workspace",
      signup: {
        create_account: "Opret konto",
        create_first_user:
          "Opret den første bruger for at gennemføre opsætningen.",
        creating: "Opretter...",
        initial_user_created: "Den første bruger er oprettet",
      },
      welcome_title: "Velkommen til LAGO CRM",
    },
    common: {
      activity: "Aktivitet",
      added: "tilføjet",
      details: "Detaljer",
      last_activity_with_date: "seneste aktivitet %{date}",
      load_more: "Vis flere",
      misc: "Diverse",
      past: "Tidligere",
      read_more: "Læs mere",
      retry: "Prøv igen",
      show_less: "Vis mindre",
      copied: "Kopieret!",
      copy: "Kopiér",
      loading: "Indlæser...",
      me: "Mig",
      task_count: "%{smart_count} opgave |||| %{smart_count} opgaver",
    },
    changelog: {
      title: "Ændringslog",
    },
    activity: {
      added_company: "%{name} tilføjede virksomhed",
      you_added_company: "Du tilføjede virksomhed",
      added_contact: "%{name} tilføjede",
      you_added_contact: "Du tilføjede",
      added_note: "%{name} skrev et notat om",
      you_added_note: "Du skrev et notat om",
      added_note_about_deal: "%{name} skrev et notat om aftalen",
      you_added_note_about_deal: "Du skrev et notat om aftalen",
      added_deal: "%{name} tilføjede aftalen",
      you_added_deal: "Du tilføjede aftalen",
      at_company: "hos",
      to: "til",
      load_more: "Vis mere aktivitet",
    },
    dashboard: {
      deals_chart: "Kommende omsætning",
      deals_pipeline: "Aftale-pipeline",
      latest_activity: "Seneste aktivitet",
      latest_activity_error: "Fejl ved indlæsning af seneste aktivitet",
      latest_notes: "Mine seneste notater",
      latest_notes_added_ago: "tilføjet %{timeAgo}",
      stepper: {
        install: "Installér LAGO CRM",
        progress: "%{step}/3 færdig",
        whats_next: "Hvad er næste skridt?",
      },
      upcoming_tasks: "Kommende opgaver",
    },
    header: {
      import_data: "Importér data",
    },
    image_editor: {
      change: "Skift",
      drop_hint: "Træk en fil hertil for at uploade, eller klik for at vælge.",
      editable_content: "Redigerbart indhold",
      title: "Upload og tilpas billede",
      update_image: "Opdatér billede",
    },
    import: {
      action: {
        download_error_report: "Hent fejlrapport",
        import: "Importér",
        import_another: "Importér en anden fil",
      },
      error: {
        unable: "Kan ikke importere denne fil.",
      },
      status: {
        all_success: "Alle poster blev importeret.",
        complete: "Import gennemført.",
        failed: "Mislykkedes",
        imported: "Importeret",
        in_progress: "Import i gang — undlad at forlade siden.",
        some_failed: "Nogle poster blev ikke importeret.",
        table_caption: "Importstatus",
      },
      title: "Importér data",
    },
    settings: {
      about: "Om",
      dark_mode_logo: "Logo (mørk tilstand)",
      light_mode_logo: "Logo (lys tilstand)",
      reset_defaults: "Nulstil til standard",
      save_error: "Konfigurationen kunne ikke gemmes",
      saved: "Konfigurationen er gemt",
      saving: "Gemmer...",
      preferences: "Præferencer",
      title: "Indstillinger",
      app_title: "Apptitel",
      sections: {
        branding: "Branding",
      },
    },
    theme: {
      dark: "Mørk",
      label: "Tema",
      light: "Lys",
      system: "System",
    },
    language: "Sprog",
    navigation: {
      label: "CRM-navigation",
    },
    profile: {
      password: {
        change: "Skift adgangskode",
      },
      password_reset_sent:
        "En mail om nulstilling af adgangskode er sendt til dig",
      record_not_found: "Posten blev ikke fundet",
      title: "Profil",
      updated: "Din profil er opdateret",
      update_error: "Der opstod en fejl. Prøv igen",
    },
    validation: {
      invalid_url: "Skal være en gyldig URL",
      invalid_linkedin_url: "URL'en skal være fra linkedin.com",
    },
  },
};
