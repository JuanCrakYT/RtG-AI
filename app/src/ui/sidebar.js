const sidebar = {
    chatManager: null,
    listElement: null,
    newChatButton: null,

    initialize({ chatManager }) {
        this.chatManager = chatManager;

        this.listElement = document.querySelector("#conversation-list");
        this.newChatButton = document.querySelector("#new-chat-button");

        if (!this.listElement) {
            throw new Error("Conversation list not found.");
        }

        if (!this.newChatButton) {
            throw new Error("New chat button not found.");
        }

        this.bindEvents();
        this.render();
    },

    bindEvents() {
        this.newChatButton.addEventListener("click", () => {
            this.createConversation();
        });

        document.addEventListener("rtg-ai:conversation-updated", () => {
            this.render();
        });
    },

    render() {
        const conversations = this.chatManager.getConversations();
        const currentConversation =
            this.chatManager.getCurrentConversation();

        this.listElement.replaceChildren();

        for (const conversation of conversations) {
            const element = this.createConversationElement(
                conversation,
                conversation.id === currentConversation?.id
            );

            this.listElement.appendChild(element);
        }
    },

    createConversationElement(conversation, active) {
        const item = document.createElement("div");
        item.className = "conversation-item";

        if (active) {
            item.classList.add("active");
        }

        item.dataset.conversationId = conversation.id;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "conversation-button";
        button.textContent = conversation.title || "Nueva conversación";
        button.title = conversation.title || "Nueva conversación";

        button.addEventListener("click", () => {
            this.selectConversation(conversation.id);
        });

        item.appendChild(button);

        return item;
    },

    createConversation() {
        const conversation =
            this.chatManager.createConversation();

        this.render();

        this.dispatchConversationChanged(conversation);

        this.focusInput();
    },

    async selectConversation(conversationId) {
        const conversation =
            await this.chatManager.selectConversation(conversationId);

        if (!conversation) {
            return;
        }

        this.render();

        this.dispatchConversationChanged(conversation);

        this.focusInput();
    },

    dispatchConversationChanged(conversation) {
        document.dispatchEvent(
            new CustomEvent("rtg-ai:conversation-changed", {
                detail: {
                    conversation
                }
            })
        );
    },

    focusInput() {
        const input = document.querySelector("#chat-input");
        input?.focus();
    },

    refresh() {
        this.render();
    }
};

export { sidebar };