import { CRM } from "@/components/atomic-crm/root/CRM";
import { LagoContactList } from "@/lago/contacts/LagoContactList";
import { LagoContactShow } from "@/lago/contacts/LagoContactShow";
import { LagoCustomerList } from "@/lago/customers/LagoCustomerList";
import { LagoCustomerShow } from "@/lago/customers/LagoCustomerShow";
import { LagoDashboard } from "@/lago/dashboard/LagoDashboard";
import { lagoI18nProvider } from "@/lago/i18n/lagoI18nProvider";
import { LagoLayout } from "@/lago/layout/LagoLayout";
import { LagoPwaAutoUpdate } from "@/lago/pwa/LagoPwaAutoUpdate";

// Brief 20 pkt 7: danske task-type-labels. Uden dem falder tidslinjen
// tilbage til upstream's engelske defaults ("Call", "Email", "Meeting").
// value-kolonnen SKAL bevares — den bruges som opslagsnøgle overalt.
const LAGO_TASK_TYPES = [
  { value: "none", label: "Ingen" },
  { value: "email", label: "E-mail" },
  { value: "demo", label: "Demo" },
  { value: "lunch", label: "Frokost" },
  { value: "meeting", label: "Møde" },
  { value: "follow-up", label: "Opfølgning" },
  { value: "thank-you", label: "Tak" },
  { value: "ship", label: "Levering" },
  { value: "call", label: "Opkald" },
];

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const App = () => (
  <>
    <LagoPwaAutoUpdate />
    <CRM
      title="LAGO CRM"
      disableTelemetry
      i18nProvider={lagoI18nProvider}
      companyShow={LagoCustomerShow}
      companyList={LagoCustomerList}
      contactShow={LagoContactShow}
      contactList={LagoContactList}
      dashboard={LagoDashboard}
      layout={LagoLayout}
      taskTypes={LAGO_TASK_TYPES}
      // Brief 22a #3 (15. sep 2026): Cold/Warm/Hot/In Contract er en
      // akse ingen hos LAGO har besluttet at bruge. Vi har allerede
      // segment (A/B/C/X) og besøgsstatus. Tømning af noteStatuses
      // fjerner filtergruppen i ContactListFilter — resten (badge,
      // farveprik, HotContacts-widget) håndteres via ContactStatusBadge
      // og eksplicit skjulning. contacts.status-kolonnen bevares i DB.
      noteStatuses={[]}
    />
  </>
);

export default App;
