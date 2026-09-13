const input = {
    ai: null,
    chatManager: null,
    modelManager: null,
    chat: null,
    preview: null,

    inputElement: null,
    sendButton: null,

    initialize({ ai, chatManager, modelManager, chat, preview }) {
        this.ai = ai;
        this.chatManager = chatManager;
        this.modelManager = modelManager;
        this.chat = chat;
        this.preview = preview;

        this.inputElement = document.querySelector("#chat-input");
        this.sendButton = document.querySelector(".send-button");

        if (!this.inputElement) {
            throw new Error("Chat input not found.");
        }

        if (!this.sendButton) {
            throw new Error("Send button not found.");
        }

        this.bindEvents();
        this.updateSendButton();
    },

    bindEvents() {
        this.inputElement.addEventListener("input", () => {
            this.updateSendButton();
        });

        this.inputElement.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            if (event.shiftKey) return;

            event.preventDefault();

            if (!this.sendButton.disabled) {
                this.send();
            }
        });

        this.sendButton.addEventListener("click", () => {
            this.send();
        });
    },

    async send() {
        const content = this.inputElement.value.trim();

        if (!content) return;

        const conversation = this.chatManager.getCurrentConversation();

        if (!conversation) {
            console.error("No active conversation.");
            return;
        }

        const model = this.modelManager.getCurrent();

        if (!model) {
            console.error("No AI model selected.");
            return;
        }

        const userMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content,
            timestamp: Date.now()
        };

        this.inputElement.value = "";
        this.updateSendButton();
        this.setLoading(true);

        this.chatManager.addMessage(userMessage);
        this.chat.addMessage(userMessage);

        try {
            const messages = this.chatManager.getMessages(
                conversation.id
            );

            const result = await this.ai.generate({
                model,
                messages
            });

            const assistantMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: result.content ?? "",
                timestamp: Date.now()
            };

            this.chatManager.addMessage(assistantMessage);
            this.chat.addMessage(assistantMessage);

            if (result.build && this.preview) {
                this.preview.render(result.build);
            }
        } catch (error) {
            console.error("AI generation failed:", error);

            const errorMessage = {
                id: crypto.randomUUID(),
                role: "system",
                content: `Error al generar la respuesta: ${error.message}`,
                timestamp: Date.now()
            };

            this.chatManager.addMessage(errorMessage);
            this.chat.addMessage(errorMessage);
        } finally {
            this.setLoading(false);
            this.inputElement.focus();
        }
    },

    updateSendButton() {
        if (!this.sendButton || !this.inputElement) return;

        const hasText = this.inputElement.value.trim().length > 0;

        this.sendButton.disabled =
            !hasText || this.sendButton.dataset.loading === "true";
    },

    setInputValue(text) {
        if (!this.inputElement) return;

        this.inputElement.value = text ?? "";
        this.updateSendButton();

        this.inputElement.focus();
        this.inputElement.scrollIntoView?.({
            behavior: "smooth",
            block: "nearest"
        });
    },

    setLoading(loading) {
        if (!this.sendButton) return;

        this.sendButton.dataset.loading = String(loading);
        this.sendButton.disabled = loading;

        this.sendButton.textContent = loading
            ? "Generando..."
            : "Generar";
    }
};

export { input };