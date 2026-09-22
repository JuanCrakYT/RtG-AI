const settings = {
    lang: null,
    modelManager: null,
    chatManager: null,
    sidebar: null,

    drawer: null,
    closeButton: null,
    themeOptions: null,
    languageSelect: null,
    modelSelect: null,
    clearConversationsButton: null,
    versionElement: null,

    initialize({ lang, modelManager, chatManager, sidebar }) {
        this.lang = lang;
        this.modelManager = modelManager;
        this.chatManager = chatManager;
        this.sidebar = sidebar;

        this.drawer = document.querySelector("#settings-drawer");
        this.closeButton = document.querySelector("#close-settings-button");
        this.themeOptions = this.drawer?.querySelectorAll(".setting-option[data-theme]");
        this.languageSelect = document.querySelector("#language-select");
        this.modelSelect = document.querySelector("#settings-model-select");
        this.clearConversationsButton = document.querySelector("#clear-conversations-button");
        this.versionElement = document.querySelector("#app-version");

        if (!this.drawer) {
            throw new Error("Settings drawer not found.");
        }

        if (!this.closeButton) {
            throw new Error("Close settings button not found.");
        }

        this.bindEvents();
        this.populateLanguageSelect();
        this.populateModelSelect();
        this.updateThemeSelection();
        this.updateLanguageSelection();
        this.updateModelSelection();
    },

    bindEvents() {
        this.closeButton.addEventListener("click", () => {
            this.hide();
        });

        // Close on click outside (overlay)
        this.drawer.addEventListener("click", (event) => {
            if (event.target === this.drawer) {
                this.hide();
            }
        });

        // Theme options
        this.themeOptions?.forEach((option) => {
            option.addEventListener("click", () => {
                this.setTheme(option.dataset.theme);
            });
        });

        // Language select
        this.languageSelect?.addEventListener("change", () => {
            this.setLanguage(this.languageSelect.value);
        });

        // Model select
        this.modelSelect?.addEventListener("change", () => {
            this.setModel(this.modelSelect.value);
        });

        // Clear conversations
        this.clearConversationsButton?.addEventListener("click", () => {
            this.clearAllConversations();
        });

        // Keyboard: Escape to close
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.isOpen()) {
                this.hide();
            }
        });

        // Listen for theme changes from sidebar
        document.addEventListener("rtg-ai:theme-changed", () => {
            this.updateThemeSelection();
        });

        // Listen for language changes
        document.addEventListener("rtg-ai:language-changed", () => {
            this.updateLanguageSelection();
        });

        // Listen for model changes
        document.addEventListener("rtg-ai:model-selected", () => {
            this.updateModelSelection();
        });
    },

    populateLanguageSelect() {
        if (!this.languageSelect || !this.lang) return;

        const languages = this.lang.getAvailableLanguages();
        this.languageSelect.innerHTML = "";

        for (const code of languages) {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = this.getLanguageName(code);
            this.languageSelect.appendChild(option);
        }
    },

    getLanguageName(code) {
        const names = {
            es: "Español",
            en: "English",
            pt: "Português",
            de: "Deutsch",
            fr: "Français",
            ru: "Русский",
            zh: "中文",
            ja: "日本語",
            ko: "한국어",
            it: "Italiano",
            tr: "Türkçe",
            pl: "Polski"
        };
        return names[code] || code;
    },

    populateModelSelect() {
        if (!this.modelSelect || !this.modelManager) return;

        const models = this.modelManager.list();
        this.modelSelect.innerHTML = "";

        for (const model of models) {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name;
            option.disabled = !model.available;
            this.modelSelect.appendChild(option);
        }
    },

    updateThemeSelection() {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";

        this.themeOptions?.forEach((option) => {
            const isActive = option.dataset.theme === currentTheme;
            option.setAttribute("aria-pressed", String(isActive));
            option.classList.toggle("active", isActive);
        });
    },

    updateLanguageSelection() {
        if (!this.languageSelect || !this.lang) return;
        this.languageSelect.value = this.lang.getCurrentLanguage();
    },

    updateModelSelection() {
        if (!this.modelSelect || !this.modelManager) return;
        const currentModel = this.modelManager.getCurrent();
        if (currentModel) {
            this.modelSelect.value = currentModel.id;
        }
    },

    setTheme(theme) {
        if (!["light", "dark", "auto"].includes(theme)) return;

        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("rtg-ai:theme", theme);

        // Update sidebar theme icon
        if (this.sidebar && typeof this.sidebar.updateThemeIcon === "function") {
            this.sidebar.updateThemeIcon(theme);
        }

        this.updateThemeSelection();

        // Notify other components
        document.dispatchEvent(
            new CustomEvent("rtg-ai:theme-changed", {
                detail: { theme }
            })
        );
    },

    setLanguage(language) {
        if (!this.lang) return;

        this.lang.setLanguage(language);

        // Update sidebar and other components
        this.lang.applyToDocument();

        // Notify other components
        document.dispatchEvent(
            new CustomEvent("rtg-ai:language-changed", {
                detail: { language }
            })
        );
    },

    async setModel(modelId) {
        if (!this.modelManager) return;

        try {
            const model = await this.modelManager.select(modelId);
            this.modelSelect.value = model.id;

            document.dispatchEvent(
                new CustomEvent("rtg-ai:model-selected", {
                    detail: { model }
                })
            );
        } catch (error) {
            console.error("Failed to select model:", error);
            this.updateModelSelection();
        }
    },

    clearAllConversations() {
        if (!this.chatManager) return;

        const confirmed = confirm(
            this.lang?.t("confirm-clear-all", "Are you sure you want to delete all conversations? This cannot be undone.")
        );

        if (!confirmed) return;

        this.chatManager.clearAllConversations();
        this.hide();
    },

    show() {
        if (!this.drawer) return;

        this.drawer.classList.add("open");
        this.drawer.setAttribute("aria-hidden", "false");

        // Focus first focusable element
        const firstFocusable = this.drawer.querySelector("button, select, [href], input, [tabindex]:not([tabindex='-1'])");
        firstFocusable?.focus();
    },

    hide() {
        if (!this.drawer) return;

        this.drawer.classList.remove("open");
        this.drawer.setAttribute("aria-hidden", "true");
    },

    isOpen() {
        return this.drawer?.classList.contains("open") ?? false;
    }
};

export { settings };