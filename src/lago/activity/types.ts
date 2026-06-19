import type { Identifier, RaRecord } from "ra-core";
import type { Activity } from "@/components/atomic-crm/types";

export const COMPANY_NOTE_CREATED = "companyNote.created" as const;

export interface CompanyNoteRecord {
  id: number;
  company_id: number;
  contact_id: number | null;
  text: string;
  sales_id: number | null;
  created_at: string;
}

export interface ActivityCompanyNoteCreated extends Pick<RaRecord, "id"> {
  type: typeof COMPANY_NOTE_CREATED;
  date: string;
  company_id: Identifier;
  sales_id?: Identifier | null;
  companyNote: CompanyNoteRecord;
}

export type LagoActivity = Activity | ActivityCompanyNoteCreated;
