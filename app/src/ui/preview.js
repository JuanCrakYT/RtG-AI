const PREVIEW_CONFIG_URL = "./src/ui/preview.json";

const preview = {
    mount: null,
    objectCount: null,
    placeholder: null,
    lang: null,

    currentBuild: null,
    config: null,
    ready: false,
    loadingPromise: null,

    async initialize({ lang } = {}) {
        this.lang = lang || null;

        this.mount = document.querySelector("#rtg-preview-mount");
        this.objectCount = document.querySelector("#object-count");
        this.placeholder = document.querySelector(".preview-placeholder");

        if (!this.mount) {
            throw new Error("RtG preview mount not found.");
        }

        this.applyTranslations();

        await this.loadPreviewer();
    },

    t(key, fallback) {
        if (this.lang && typeof this.lang.t === "function") {
            return this.lang.t(key, fallback);
        }

        return fallback ?? key;
    },

    applyTranslations() {
        if (!this.placeholder) return;

        const title = this.placeholder.querySelector("strong");
        const instruction = this.placeholder.querySelector("span");

        if (title) {
            title.textContent = this.t("no-build", "Sin build todavía");
        }

        if (instruction) {
            instruction.textContent = this.t(
                "no-build-instruction",
                "Genera una build para verla aquí."
            );
        }
    },

    async loadPreviewer() {
        if (this.ready && window.RtGPreview) {
            return;
        }

        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this.loadPreviewerFromConfig();

        try {
            await this.loadingPromise;
        } finally {
            this.loadingPromise = null;
        }
    },

    async loadPreviewerFromConfig() {
        const response = await fetch(PREVIEW_CONFIG_URL);

        if (!response.ok) {
            throw new Error(
                `Failed to load preview configuration: ${response.status}`
            );
        }

        const config = await response.json();

        this.validateConfig(config);

        this.config = config;

        if (window.RtGPreview) {
            this.ready = true;
            return;
        }

        const url =
            `https://cdn.jsdelivr.net/gh/` +
            `${config.repository}@${config.commit}` +
            `/RtG-Preview/preview.js`;

        await this.loadScript(url);

        if (!window.RtGPreview) {
            throw new Error(
                "RtGPreview was not defined after loading preview.js."
            );
        }

        this.ready = true;
    },

    loadScript(url) {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                `script[src="${url}"]`
            );

            if (existingScript) {
                existingScript.addEventListener("load", resolve, {
                    once: true
                });

                existingScript.addEventListener("error", () => {
                    reject(
                        new Error(
                            `Failed to load RtG-Preview from ${url}`
                        )
                    );
                }, {
                    once: true
                });

                return;
            }

            const script = document.createElement("script");

            script.src = url;
            script.async = false;

            script.addEventListener("load", resolve, {
                once: true
            });

            script.addEventListener("error", () => {
                reject(
                    new Error(
                        `Failed to load RtG-Preview from ${url}`
                    )
                );
            }, {
                once: true
            });

            document.head.appendChild(script);
        });
    },

    validateConfig(config) {
        if (!config || typeof config !== "object") {
            throw new Error("Invalid RtG-Preview configuration.");
        }

        if (
            typeof config.repository !== "string" ||
            !config.repository.trim()
        ) {
            throw new Error(
                "RtG-Preview configuration is missing repository."
            );
        }

        if (
            typeof config.commit !== "string" ||
            !config.commit.trim()
        ) {
            throw new Error(
                "RtG-Preview configuration is missing commit."
            );
        }

        if (
            typeof config.branch !== "string" ||
            !config.branch.trim()
        ) {
            throw new Error(
                "RtG-Preview configuration is missing branch."
            );
        }
    },

    async render(build) {
        if (!Array.isArray(build)) {
            throw new TypeError(
                "RtG build must be an array."
            );
        }

        if (!this.ready) {
            await this.loadPreviewer();
        }

        this.currentBuild = build;

        this.updateObjectCount(build);
        this.hidePlaceholder();

        try {
            window.RtGPreview.render(build);
        } catch (error) {
            console.error(
                "Failed to render RtG build:",
                error
            );

            this.showPlaceholder(
                "No se pudo renderizar la build."
            );

            throw error;
        }
    },

    clear() {
        this.currentBuild = null;

        this.updateObjectCount([]);

        if (this.mount) {
            this.mount.replaceChildren();
        }

        this.showPlaceholder();
    },

    getBuild() {
        return this.currentBuild;
    },

    getConfig() {
        return this.config;
    },

    updateObjectCount(build) {
        if (!this.objectCount) return;

        const count = build.length;

        this.objectCount.textContent =
            `${count} objeto${count === 1 ? "" : "s"}`;
    },

    hidePlaceholder() {
        if (!this.placeholder) return;

        this.placeholder.hidden = true;
    },

    showPlaceholder(message = "Sin build todavía") {
        if (!this.placeholder) return;

        this.placeholder.hidden = false;
        this.placeholder.textContent = message;
    }
};

export { preview };