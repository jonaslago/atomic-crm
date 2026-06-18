import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, i18nProvider } from "./i18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("registers da, en and fr locales", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "da", name: "Dansk" },
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
    ]);
  });

  it("translates the language key in danish", async () => {
    await i18nProvider.changeLocale("da");

    expect(i18nProvider.translate("crm.language")).toBe("Sprog");
  });

  it("translates the language key in french", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("falls back to danish for unknown locales", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("crm.language")).toBe("Sprog");
  });

  it("uses customized password reset overrides for da, en and fr", async () => {
    await i18nProvider.changeLocale("da");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Tjek din mail for en besked om nulstilling af adgangskoden.",
    );

    await i18nProvider.changeLocale("en");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Check your emails for a Reset Password message.",
    );

    await i18nProvider.changeLocale("fr");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    );
  });

  it("translates recently added fr crm keys", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "Aucune affaire trouvée",
    );
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });

    expect(getInitialLocale()).toBe("fr");
  });

  it("uses browser english locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "en-US",
      languages: ["en-US", "en-GB"],
    });

    expect(getInitialLocale()).toBe("en");
  });

  it("falls back to danish when browser locale is unsupported", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });

    expect(getInitialLocale()).toBe("da");
  });
});
