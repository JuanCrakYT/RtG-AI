const PREVIEW_CONFIG_URL = "./src/ui/preview.json";

const preview = {
    mount: null,
    objectCount: null,
    placeholder: null,
    lang: null,
    drawer: null,
    closeButton: null,
    clearButton: null,
    viewPreviewButton: null,

    currentBuild: null,
    config: null,
    ready: false,
    loadingPromise: null,
    hasPendingUpdate: false,
    previewHandle: null,

    async initialize({ lang } = {}) {
        this.lang = lang || null;

        this.drawer = document.querySelector("#preview-drawer");
        this.mount = document.querySelector("#rtg-preview-mount");
        this.objectCount = document.querySelector("#object-count");
        this.placeholder = this.mount?.querySelector(".preview-placeholder");
        this.closeButton = document.querySelector("#close-preview-button");
        this.clearButton = document.querySelector("#clear-preview-button");
        this.viewPreviewButton = document.querySelector("#view-preview-button");

        if (!this.drawer) {
            throw new Error("Preview drawer not found.");
        }

        if (!this.mount) {
            throw new Error("RtG preview mount not found.");
        }

        if (!this.closeButton) {
            throw new Error("Close preview button not found.");
        }

        if (!this.clearButton) {
            throw new Error("Clear preview button not found.");
        }

        this.applyTranslations();
        this.bindEvents();

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

    bindEvents() {
        this.closeButton.addEventListener("click", () => {
            this.hide();
        });

        this.clearButton.addEventListener("click", () => {
            this.clear();
        });
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
            throw new TypeError("RtG build must be an array.");
        }

        if (!this.ready) {
            await this.loadPreviewer();
        }

        this.currentBuild = build;

        if (this.isOpen()) {
            this.hasPendingUpdate = false;
            this.updateIndicator();
            this.updateObjectCount(build);
            this.hidePlaceholder();

            try {
                await this.renderToMount(build);
            } catch (error) {
                console.error("Failed to render RtG build:", error);
                this.showPlaceholder("No se pudo renderizar la build.");
                throw error;
            }
        } else {
            this.markPendingUpdate();
            this.updateObjectCount(build);
        }
    },

    async renderToMount(build) {
        if (this.previewHandle) {
            this.previewHandle.dispose();
            this.previewHandle = null;
        }

        try {
            this.previewHandle = await window.RtGPreview.render(build, {
                container: this.mount
            });
        } catch (error) {
            this.previewHandle = null;
            throw error;
        }
    },

    clear() {
        this.currentBuild = null;
        this.hasPendingUpdate = false;
        this.updateIndicator();

        this.updateObjectCount([]);

        this.disposePreview();

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
        if (message !== "Sin build todavía") {
            this.placeholder.textContent = message;
        }
    },

    markPendingUpdate() {
        this.hasPendingUpdate = true;
        this.updateIndicator();
    },

    updateIndicator() {
        if (!this.viewPreviewButton) return;

        if (this.hasPendingUpdate) {
            this.viewPreviewButton.classList.add("has-update");
        } else {
            this.viewPreviewButton.classList.remove("has-update");
        }
    },

    show() {
        if (!this.drawer) return;

        this.drawer.classList.add("open");
        this.drawer.setAttribute("aria-hidden", "false");
        document.getElementById("app")?.classList.add("has-preview");

        if (this.hasPendingUpdate && this.currentBuild) {
            this.render(this.currentBuild);
        }
    },

    hide() {
        if (!this.drawer) return;

        this.disposePreview();

        this.drawer.classList.remove("open");
        this.drawer.setAttribute("aria-hidden", "true");
        document.getElementById("app")?.classList.remove("has-preview");
    },

    disposePreview() {
        if (this.previewHandle) {
            this.previewHandle.dispose();
            this.previewHandle = null;
        }

        if (this.mount) {
            this.mount.replaceChildren();

            const placeholder = document.createElement("div");
            placeholder.className = "preview-placeholder";
            placeholder.style.cssText = "position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 13px; color: var(--text-muted); text-align: left;";
            placeholder.innerHTML = `
                <div class="placeholder-icon" style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); font-family: monospace; font-size: 17px;">+</div>
                <div>
                    <strong data-i18n="no-build">Sin build todavía</strong>
                    <span data-i18n="no-build-instruction">Genera una build para verla aquí.</span>
                </div>
            `;
            this.mount.appendChild(placeholder);
            this.placeholder = placeholder;
            this.applyTranslations();
        }
    },

    isOpen() {
        return this.drawer?.classList.contains("open") ?? false;
    }
};

export { preview };