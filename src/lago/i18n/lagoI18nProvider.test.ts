import { afterEach, describe, expect, it, vi } from "vitest";
import { getLagoInitialLocale, lagoI18nProvider } from "./lagoI18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lagoI18nProvider", () => {
  it("registers da, en and fr locales", () => {
    expect(lagoI18nProvider.getLocales?.()).toEqual([
      { locale: "da", name: "Dansk" },
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
    ]);
  });

  it("translates the language key in danish", async () => {
    await lagoI18nProvider.changeLocale("da");
    expect(lagoI18nProvider.translate("crm.language")).toBe("Sprog");
  });

  it("translates the language key in french", async () => {
    await lagoI18nProvider.changeLocale("fr");
    expect(lagoI18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("translates the language key in english", async () => {
    await lagoI18nProvider.changeLocale("en");
    expect(lagoI18nProvider.translate("crm.language")).toBe("Language");
  });

  it("uses the danish password reset override", async () => {
    await lagoI18nProvider.changeLocale("da");
    expect(lagoI18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Tjek din mail for en besked om nulstilling af adgangskoden.",
    );
  });

  it("falls back to danish for unknown locales", async () => {
    await lagoI18nProvider.changeLocale("es");
    expect(lagoI18nProvider.translate("crm.language")).toBe("Sprog");
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });
    expect(getLagoInitialLocale()).toBe("fr");
  });

  it("uses browser english locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "en-US",
      languages: ["en-US"],
    });
    expect(getLagoInitialLocale()).toBe("en");
  });

  it("falls back to danish when browser locale is unsupported", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });
    expect(getLagoInitialLocale()).toBe("da");
  });
});
