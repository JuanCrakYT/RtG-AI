const modelSelector = {
    modelManager: null,
    selectElement: null,

    initialize({ modelManager }) {
        this.modelManager = modelManager;
        this.selectElement = document.querySelector("#model-selector");

        if (!this.selectElement) {
            throw new Error("Model selector not found.");
        }

        this.render();
        this.bindEvents();
    },

    render() {
        const models = this.modelManager.list();
        const currentModel = this.modelManager.getCurrent();

        this.selectElement.replaceChildren();

        for (const model of models) {
            const option = document.createElement("option");

            option.value = model.id;
            option.textContent = model.name;
            option.disabled = !model.available;

            if (currentModel?.id === model.id) {
                option.selected = true;
            }

            this.selectElement.appendChild(option);
        }
    },

    bindEvents() {
        this.selectElement.addEventListener("change", async () => {
            await this.select(this.selectElement.value);
        });
    },

    async select(modelId) {
        try {
            const model = await this.modelManager.select(modelId);

            this.selectElement.value = model.id;

            const conversationEvent = new CustomEvent(
                "rtg-ai:model-selected",
                {
                    detail: {
                        model
                    }
                }
            );

            document.dispatchEvent(conversationEvent);
        } catch (error) {
            console.error("Failed to select AI model:", error);

            this.render();
        }
    },

    refresh() {
        this.render();
    },

    getSelectedModel() {
        return this.modelManager.getCurrent();
    }
};

export { modelSelector };