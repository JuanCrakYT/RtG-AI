/**
 * suggested.js
 *
 * Loads suggested prompts from `suggested.json` and renders them as
 * clickable chips inside the `#quick-prompts` container.
 *
 * The data source is the only place prompts are defined. Adding new
 * prompts only requires editing the JSON file.
 */

import { logger } from "../core/log.js";

const SUGGESTED_JSON_PATH = "./src/ui/suggested.json";

const suggested = {
    container: null,
    input: null,
    data: null,
    lang: null,

    async initialize({ input, lang }) {
        logger.log("INIT", "suggested initializing");
        this.input = input;
        this.lang = lang;
        this.container = document.querySelector("#quick-prompts");

        if (!this.container) {
            throw new Error("Quick prompts container not found.");
        }

        if (!this.input) {
            throw new Error("Input module reference is required.");
        }

        await this.loadData();
        this.render();

        document.addEventListener("rtg-ai:language-changed", () => {
            this.render();
        });
        logger.log("INIT", "suggested initialized");
    },

    async loadData() {
        try {
            const response = await fetch(SUGGESTED_JSON_PATH, {
                headers: { Accept: "application/json" }
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to load suggested prompts: ${response.status} ${response.statusText}`
                );
            }

            this.data = await response.json();
            logger.log("NETWORK", "loaded suggested prompts");
        } catch (error) {
            logger.error("NETWORK", "Suggested prompts loading failed", error);
            this.data = [];
        }
    },

    render() {
        if (!this.container) return;

        this.container.replaceChildren();

        if (!Array.isArray(this.data) || this.data.length === 0) {
            return;
        }

        const currentLanguage = this.lang?.getCurrentLanguage() ?? "es";

        for (const entry of this.data) {
            const localized = entry?.[currentLanguage] ?? entry?.es;

            if (!localized || typeof localized !== "object") {
                continue;
            }

            for (const [key, value] of Object.entries(localized)) {
                if (!Array.isArray(value) || value.length < 2) {
                    continue;
                }

                const [label, prompt] = value;

                if (typeof label !== "string" || typeof prompt !== "string") {
                    continue;
                }

                this.createChip(key, label, prompt);
            }
        }
    },

    createChip(id, label, prompt) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-prompt";
        button.dataset.promptId = id;
        button.dataset.promptText = prompt;
        button.textContent = label;
        button.title = prompt;

        button.addEventListener("click", () => {
            logger.log("CLICK", `clicked suggested prompt ${id}`);
            this.selectPrompt(prompt);
        });

        this.container.appendChild(button);
    },

    selectPrompt(prompt) {
        if (!this.input || typeof prompt !== "string") return;

        this.input.setInputValue(prompt);
    }
};

export { suggested };