/**
 * lang.js
 *
 * Loads translations from `lang.json` and exposes a tiny i18n helper.
 *
 * The default language is `es`. The language can be changed later via
 * `lang.setLanguage(code)` without reorganizing the UI code.
 *
 * Usage:
 *   lang.t("key")            -> string
 *   lang.getCurrentLanguage() -> "es"
 *   lang.getAvailableLanguages() -> ["es", "en", ...]
 */

const LANG_JSON_PATH = "../lang.json";

const lang = {
    data: null,
    currentLanguage: "es",
    fallbackLanguage: "es",

    async initialize() {
        await this.loadData();
    },

    async loadData() {
        try {
            const response = await fetch(LANG_JSON_PATH, {
                headers: { Accept: "application/json" }
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to load language data: ${response.status} ${response.statusText}`
                );
            }

            this.data = await response.json();
        } catch (error) {
            console.error("Language data loading failed:", error);
            this.data = {};
        }
    },

    getAvailableLanguages() {
        if (!this.data || typeof this.data !== "object") {
            return [this.fallbackLanguage];
        }

        return Object.keys(this.data).filter(Boolean);
    },

    getCurrentLanguage() {
        return this.currentLanguage;
    },

    setLanguage(language) {
        if (!language) return;

        this.currentLanguage = language;
        this.applyToDocument();
    },

    getEntry(language) {
        if (!this.data || typeof this.data !== "object") return null;

        return this.data[language] || null;
    },

    t(key, fallback) {
        if (!key) return fallback ?? "";

        const localized = this.getEntry(this.currentLanguage);
        if (localized && Object.prototype.hasOwnProperty.call(localized, key)) {
            return localized[key];
        }

        const fallbackLocalized = this.getEntry(this.fallbackLanguage);
        if (
            fallbackLocalized &&
            Object.prototype.hasOwnProperty.call(fallbackLocalized, key)
        ) {
            return fallbackLocalized[key];
        }

        return fallback ?? key;
    },

    applyToDocument() {
        if (typeof document === "undefined") return;

        document.querySelectorAll("[data-i18n]").forEach((element) => {
            const key = element.getAttribute("data-i18n");
            if (!key) return;

            const value = this.t(key);
            if (element.tagName === "INPUT" && element.type === "text") {
                element.placeholder = value;
            } else {
                element.textContent = value;
            }
        });

        document.querySelectorAll("[data-i18n-title]").forEach((element) => {
            const key = element.getAttribute("data-i18n-title");
            if (!key) return;

            element.setAttribute("title", this.t(key));
        });

        document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
            const key = element.getAttribute("data-i18n-aria");
            if (!key) return;

            element.setAttribute("aria-label", this.t(key));
        });
    }
};

export { lang };