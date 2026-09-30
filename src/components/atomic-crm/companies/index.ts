import { CompanyList } from "./CompanyList";
import { CompanyCreate } from "./CompanyCreate";
import { CompanyShow } from "./CompanyShow";

// §32f (30. sep 2026): CompanyEdit removed. Customers cannot be edited
// or deleted in the CRM — deactivation happens in VISMA and arrives
// via import. CompanyCreate is kept for upstream compatibility.
export default {
  list: CompanyList,
  create: CompanyCreate,
  show: CompanyShow,
};
