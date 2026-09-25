import { modelManager } from "./modelManager.js";
import { logger } from "./log.js";


/**
 * RtG-AI model interface.
 *
 * The UI communicates with the AI exclusively through this module.
 *
 * Current implementation:
 *     Mock model
 *
 * Future implementation:
 *     C++ runtime → GGUF model
 */

const ai = {

    async generate({
        model,
        messages
    }) {
        const selectedModel =
            model ??
            modelManager.getCurrent();

        if (!selectedModel) {
            throw new Error("No AI model selected.");
        }

        if (!Array.isArray(messages)) {
            throw new TypeError(
                "AI messages must be an array."
            );
        }

        logger.log("AI", `generation started with model ${selectedModel.id ?? "unknown"}`);

        /*
         * Temporary mock response.
         *
         * This is intentionally simple. It should eventually
         * be replaced by the native runtime without changing
         * the public ai.generate() interface.
         */
        try {
            const result = await this.mockGenerate({
                model: selectedModel,
                messages
            });
            logger.log("AI", "generation completed");
            return result;
        } catch (error) {
            logger.error("AI", "generation failed", error);
            throw error;
        }
    },


    async mockGenerate({
        model,
        messages
    }) {
        await delay(350);

        const lastUserMessage =
            [...messages]
                .reverse()
                .find((message) => message.role === "user");

        const prompt =
            lastUserMessage?.content?.trim() ??
            "";

        const build = createMockBuild(prompt);

        return {
            model: model.id ?? model,
            content: build.message,
            build: build.json
        };
    }
};


/**
 * Temporary mock RtG response.
 *
 * This is NOT intended to represent the final AI behavior.
 * It only gives the interface something realistic to work with
 * while the actual model does not exist yet.
 */
function createMockBuild(prompt) {
    const lower = prompt.toLowerCase();

    let rgb = [180, 180, 180];

    if (lower.includes("rojo")) {
        rgb = [255, 0, 0];
    } else if (lower.includes("verde")) {
        rgb = [0, 255, 0];
    } else if (lower.includes("azul")) {
        rgb = [0, 0, 255];
    } else if (lower.includes("amarillo")) {
        rgb = [255, 255, 0];
    }

    const json = [
        [
            "Part",
            [],
            {
                RGB: rgb
            }
        ]
    ];

    return {
        message:
            prompt
                ? `Generé una build de prueba para: "${prompt}".`
                : "Generé una build de prueba.",

        json
    };
}


/**
 * Small async delay used by the mock model.
 */
function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}


export { ai };