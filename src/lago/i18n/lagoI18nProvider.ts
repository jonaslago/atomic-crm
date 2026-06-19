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
      password_reset:
        "Tjek din mail for en besked om nulstilling af adgangskoden.",
      missing_tokens:
        "Manglende eller ugyldige tokens — anmod om en ny mail om nulstilling af adgangskode.",
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
  raSupabaseDanishOverride,
  danishCrmMessages,
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
