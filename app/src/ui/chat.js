import { createMessageElement } from "./message.js";

const chat = {
    chatManager: null,
    feedbackUI: null,
    container: null,

    initialize({ chatManager, feedbackUI }) {
        this.chatManager = chatManager;
        this.feedbackUI = feedbackUI;
        this.container = document.querySelector("#chat-messages");

        if (!this.container) {
            throw new Error("Chat messages container not found.");
        }

        this.render();
    },

    render() {
        if (!this.container) return;

        this.clear();

        const conversation = this.chatManager.getCurrentConversation();

        if (!conversation) {
            return;
        }

        for (const message of conversation.messages) {
            this.renderMessage(message, false);
        }

        this.scrollToBottom();
    },

    renderMessage(message, scroll = true) {
        if (!this.container) return;

        const element = createMessageElement(message, {
            onFeedback: (messageData, rating) => {
                this.handleFeedback(messageData, rating);
            }
        });

        this.container.appendChild(element);

        if (scroll) {
            this.scrollToBottom();
        }

        return element;
    },

    addMessage(message) {
        return this.renderMessage(message);
    },

    removeMessage(messageId) {
        const element = this.container?.querySelector(
            `[data-message-id="${CSS.escape(messageId)}"]`
        );

        element?.remove();
    },

    clear() {
        if (this.container) {
            this.container.replaceChildren();
        }
    },

    scrollToBottom() {
        if (!this.container) return;

        this.container.scrollTo({
            top: this.container.scrollHeight,
            behavior: "smooth"
        });
    },

    refresh() {
        this.render();
    },

    handleFeedback(message, rating) {
        if (!this.feedbackUI) return;

        this.feedbackUI.handle({
            message,
            rating
        });
    }
};

export { chat };