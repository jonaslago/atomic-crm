import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import danishMessages from "ra-language-danish";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { raSupabaseFrenchMessages } from "ra-supabase-language-french";
import { englishCrmMessages } from "@/components/atomic-crm/providers/commons/englishCrmMessages";
import { frenchCrmMessages } from "@/components/atomic-crm/providers/commons/frenchCrmMessages";
import { danishCrmMessages } from "./danishCrmMessages";
import { danishLagoMessages } from "./danishLagoMessages";

// LAGO's i18n provider. Rebuilds the polyglot chain instead of touching
// upstream's provider, so atomic-crm upgrades stay merge-safe.

const raSupabaseEnglishOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
  },
};

const raSupabaseFrenchOverride = {
  "ra-supabase": {
    auth: {
      password_reset:
        "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    },
  },
};

// No ra-supabase-language-danish exists upstream, so we inline the few
// Supabase auth strings here.
const raSupabaseDanishOverride = {
  "ra-supabase": {
    auth: {
      // Login-siden bruger denne key til linket under formularen.
      // Brief 20 pkt 7: "Forgot password?" skal være dansk.
      forgot_password: "Glemt adgangskode?",
      password_reset:
        "Tjek din mail for en besked om nulstilling af adgangskoden.",
      missing_tokens:
        "Manglende eller ugyldige tokens — anmod om en ny mail om nulstilling af adgangskode.",
    },
    reset_password: {
      // Forgot-password-siden (StartPage sender hertil) bruger denne key.
      forgot_password: "Glemt adgangskode?",
      forgot_password_details:
        "Indtast din e-mail nedenfor, og vi sender dig en besked med et link til at nulstille adgangskoden.",
    },
    set_password: {
      new_password: "Vælg adgangskode",
    },
  },
};

// ra-language-danish is missing a handful of keys that ra-core / the
// shadcn admin components query directly (sort button labels, pagination
// footer). Overlay them here so LAGO surfaces are consistently Danish
// without touching upstream files or forking the language pack.
const raCoreDanishOverride = {
  ra: {
    sort: {
      sort_by: "Sortér efter %{field_lower_first} %{order}",
      ASC: "stigende",
      DESC: "faldende",
    },
    navigation: {
      page_rows_per_page: "Rækker pr. side:",
    },
    auth: {
      // ra-language-danish oversætter ikke password-labelen; set-password-
      // siden viser den engelsk (upstream fallback). Override her.
      password: "Adgangskode",
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishOverride,
  englishCrmMessages,
);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  raSupabaseFrenchMessages,
  raSupabaseFrenchOverride,
  frenchCrmMessages,
);

const danishCatalog = mergeTranslations(
  englishCatalog,
  danishMessages,
  raCoreDanishOverride,
  raSupabaseDanishOverride,
  danishCrmMessages,
  danishLagoMessages,
);

export const getLagoInitialLocale = (): "da" | "en" | "fr" => {
  if (typeof navigator === "undefined") {
    return "da";
  }

  const browserLocale = navigator.languages?.[0] ?? navigator.language;
  if (browserLocale?.toLowerCase().startsWith("fr")) {
    return "fr";
  }
  if (browserLocale?.toLowerCase().startsWith("en")) {
    return "en";
  }

  return "da";
};

export const lagoI18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    if (locale === "en") {
      return englishCatalog;
    }
    return danishCatalog;
  },
  getLagoInitialLocale(),
  [
    { locale: "da", name: "Dansk" },
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);
