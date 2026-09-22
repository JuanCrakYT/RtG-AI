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
        this.handleAutoResize();
    },

    bindEvents() {
        this.inputElement.addEventListener("input", () => {
            this.updateSendButton();
            this.autoResize();
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
        this.autoResize();
        this.setLoading(true);

        this.chatManager.addMessage(userMessage);
        this.chat.addMessage(userMessage);

        // Hide quick prompts when first message is sent
        this.hideQuickPrompts();

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
        this.autoResize();

        this.inputElement.focus();
        this.inputElement.scrollIntoView?.({
            behavior: "smooth",
            block: "nearest"
        });

        this.hideQuickPrompts();
    },

    setLoading(loading) {
        if (!this.sendButton) return;

        this.sendButton.dataset.loading = String(loading);
        this.sendButton.disabled = loading;

        if (loading) {
            this.sendButton.innerHTML = `
                <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
            `;
        } else {
            this.sendButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            `;
        }
    },

    hideQuickPrompts() {
        const quickPrompts = document.querySelector("#quick-prompts");
        if (quickPrompts && !quickPrompts.classList.contains("hidden")) {
            quickPrompts.classList.add("hidden");
        }
    },

    showQuickPrompts() {
        const quickPrompts = document.querySelector("#quick-prompts");
        if (quickPrompts && quickPrompts.classList.contains("hidden")) {
            quickPrompts.classList.remove("hidden");
        }
    },

    autoResize() {
        if (!this.inputElement) return;

        this.inputElement.style.height = "auto";
        const newHeight = Math.min(this.inputElement.scrollHeight, 200);
        this.inputElement.style.height = `${newHeight}px`;
    },

    handleAutoResize() {
        // Initial resize
        this.autoResize();
    }
};

export { input };