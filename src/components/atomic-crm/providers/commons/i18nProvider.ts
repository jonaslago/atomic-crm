import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import danishMessages from "ra-language-danish";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { raSupabaseFrenchMessages } from "ra-supabase-language-french";
import { danishCrmMessages } from "./danishCrmMessages";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
  },
};

const raSupabaseFrenchMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset:
        "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    },
  },
};

// No ra-supabase-language-danish package exists upstream, so we override
// the few Supabase auth strings inline.
const raSupabaseDanishMessagesOverride = {
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
  raSupabaseEnglishMessagesOverride,
  englishCrmMessages,
);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  raSupabaseFrenchMessages,
  raSupabaseFrenchMessagesOverride,
  frenchCrmMessages,
);

const danishCatalog = mergeTranslations(
  englishCatalog,
  danishMessages,
  raSupabaseDanishMessagesOverride,
  danishCrmMessages,
);

export const getInitialLocale = (): "da" | "en" | "fr" => {
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

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    if (locale === "en") {
      return englishCatalog;
    }
    return danishCatalog;
  },
  getInitialLocale(),
  [
    { locale: "da", name: "Dansk" },
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);
