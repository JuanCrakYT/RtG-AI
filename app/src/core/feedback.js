const feedback = {
    /**
     * Submit feedback for an AI response.
     *
     * This is the public API used by the UI.
     * The implementation is intentionally local for now.
     */
    async submit({
        messageId,
        model,
        rating,
        reason = null,
        metadata = {}
    }) {
        const data = this.createFeedback({
            messageId,
            model,
            rating,
            reason,
            metadata
        });

        this.validate(data);

        return this.process(data);
    },

    /**
     * Creates the normalized feedback object.
     */
    createFeedback({
        messageId,
        model,
        rating,
        reason,
        metadata
    }) {
        return {
            id: crypto.randomUUID(),
            messageId,
            model: this.normalizeModel(model),
            rating,
            reason: reason ?? null,
            metadata,
            timestamp: Date.now()
        };
    },

    /**
     * Normalizes the model into a value that can safely
     * be stored or sent to a future backend.
     */
    normalizeModel(model) {
        if (!model) {
            return null;
        }

        if (typeof model === "string") {
            return model;
        }

        return model.id ?? null;
    },

    /**
     * Validates feedback before processing it.
     */
    validate(data) {
        if (!data.messageId) {
            throw new Error(
                "Feedback requires a message ID."
            );
        }

        if (data.rating !== 1 && data.rating !== -1) {
            throw new Error(
                "Feedback rating must be 1 or -1."
            );
        }

        if (!data.model) {
            throw new Error(
                "Feedback requires a model."
            );
        }

        if (
            data.reason !== null &&
            typeof data.reason !== "string"
        ) {
            throw new Error(
                "Feedback reason must be a string or null."
            );
        }
    },

    /**
     * Processes validated feedback.
     *
     * Currently this only prepares the data locally.
     * The server request will be added here later.
     */
    async process(data) {
        console.debug("RtG-AI feedback:", data);

        // Future server integration:
        //
        // return fetch("/api/feedback", {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json"
        //     },
        //     body: JSON.stringify(data)
        // });

        return {
            success: true,
            data
        };
    }
};

export { feedback };