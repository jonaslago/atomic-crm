// Central catalogue of activity types the Registrér modal can write to
// customer_activities_lago. Codes match the VISMA type-column the
// importers already speak (see aktivitets-importen). Adding new codes is
// just a matter of appending here — nothing in the DB has to change.

export interface ActivityTypeOption {
  code: number;
  label: string;
  labelKey: string;
}

// Besøg is its own code (1) and gets its own tab, so the "Aktivitet"-tab
// only lists the non-besøg types.
export const AKTIVITET_TYPES: readonly ActivityTypeOption[] = [
  {
    code: 5,
    label: "Opkald",
    labelKey: "lago.registrer.activity_types.opkald",
  },
  {
    code: 10,
    label: "Event",
    labelKey: "lago.registrer.activity_types.event",
  },
  {
    code: 2,
    label: "Kampagne",
    labelKey: "lago.registrer.activity_types.kampagne",
  },
  {
    code: 4,
    label: "Egen henvendelse",
    labelKey: "lago.registrer.activity_types.egen_henvendelse",
  },
  { code: 99, label: "Andet", labelKey: "lago.registrer.activity_types.andet" },
] as const;

export const BESOEG_CODE = 1;
