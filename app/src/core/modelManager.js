const DEFAULT_MODELS = [
    {
        id: "rtg-ai-mock",
        name: "RtG-AI Mock",
        description: "Modelo de prueba para desarrollo de la interfaz.",
        type: "mock",
        available: true
    }
];

import { logger } from "./log.js";

const modelManager = {
    models: [],
    currentModelId: null,


    async initialize() {
        logger.log("INIT", "modelManager initializing");
        this.models = [...DEFAULT_MODELS];

        const savedModel =
            localStorage.getItem("rtg-ai-selected-model");

        if (
            savedModel &&
            this.models.some((model) => model.id === savedModel)
        ) {
            this.currentModelId = savedModel;
        } else {
            this.currentModelId =
                this.models[0]?.id ?? null;
        }
        logger.log("MODEL", `current model: ${this.currentModelId}`);
    },


    list() {
        return [...this.models];
    },


    getCurrent() {
        if (!this.currentModelId) {
            return null;
        }

        return this.models.find(
            (model) => model.id === this.currentModelId
        ) ?? null;
    },


    get(id) {
        return this.models.find(
            (model) => model.id === id
        ) ?? null;
    },


    async select(id) {
        const model = this.get(id);

        if (!model) {
            throw new Error(
                `Unknown AI model: ${id}`
            );
        }

        if (!model.available) {
            throw new Error(
                `AI model is not available: ${id}`
            );
        }

        this.currentModelId = model.id;

        localStorage.setItem(
            "rtg-ai-selected-model",
            model.id
        );

        logger.log("MODEL", `selected model ${id}`);
        return model;
    },


    has(id) {
        return this.models.some(
            (model) => model.id === id
        );
    }
};


export {
    modelManager
};