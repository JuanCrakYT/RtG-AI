const modelSelector = {
    modelManager: null,
    selectElement: null,
    headerContainer: null,

    initialize({ modelManager }) {
        this.modelManager = modelManager;
        this.headerContainer = document.querySelector("#header-model-selector");

        if (!this.headerContainer) {
            throw new Error("Header model selector container not found.");
        }

        this.render();
        this.bindEvents();
    },

    render() {
        const models = this.modelManager.list();
        const currentModel = this.modelManager.getCurrent();

        this.headerContainer.innerHTML = `
            <select id="model-selector" aria-label="Seleccionar modelo">
                ${models.map(model => `
                    <option value="${model.id}" ${currentModel?.id === model.id ? "selected" : ""} ${!model.available ? "disabled" : ""}>
                        ${model.name}
                    </option>
                `).join("")}
            </select>
        `;

        this.selectElement = document.querySelector("#model-selector");
    },

    bindEvents() {
        if (!this.selectElement) return;

        this.selectElement.addEventListener("change", async () => {
            await this.select(this.selectElement.value);
        });
    },

    async select(modelId) {
        try {
            const model = await this.modelManager.select(modelId);

            if (this.selectElement) {
                this.selectElement.value = model.id;
            }

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