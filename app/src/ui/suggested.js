/**
 * suggested.js
 *
 * Loads suggested prompts from `suggested.json` and renders them as
 * clickable chips inside the `#quick-prompts` container.
 *
 * The data source is the only place prompts are defined. Adding new
 * prompts only requires editing the JSON file.
 */

const SUGGESTED_JSON_PATH = "./src/ui/suggested.json";

const suggested = {
    container: null,
    input: null,
    data: null,
    currentLanguage: "es",

    async initialize({ input }) {
        this.input = input;
        this.container = document.querySelector("#quick-prompts");

        if (!this.container) {
            throw new Error("Quick prompts container not found.");
        }

        if (!this.input) {
            throw new Error("Input module reference is required.");
        }

        await this.loadData();
        this.render();
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
        } catch (error) {
            console.error("Suggested prompts loading failed:", error);
            this.data = [];
        }
    },

    getLanguage() {
        return this.currentLanguage;
    },

    setLanguage(language) {
        if (!language) return;

        this.currentLanguage = language;
        this.render();
    },

    render() {
        if (!this.container) return;

        this.container.replaceChildren();

        if (!Array.isArray(this.data) || this.data.length === 0) {
            return;
        }

        for (const entry of this.data) {
            const localized = entry?.[this.currentLanguage] ?? entry?.es;

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