import { CRM } from "@/components/atomic-crm/root/CRM";
import { LagoCustomerList } from "@/lago/customers/LagoCustomerList";
import { LagoCustomerShow } from "@/lago/customers/LagoCustomerShow";
import { LagoDashboard } from "@/lago/dashboard/LagoDashboard";
import { lagoI18nProvider } from "@/lago/i18n/lagoI18nProvider";
import { LagoPwaAutoUpdate } from "@/lago/pwa/LagoPwaAutoUpdate";

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
      disableTelemetry
      i18nProvider={lagoI18nProvider}
      companyShow={LagoCustomerShow}
      companyList={LagoCustomerList}
      dashboard={LagoDashboard}
    />
  </>
);

export default App;
