import { createMessageElement } from "./message.js";
import { logger } from "../core/log.js";

const chat = {
    chatManager: null,
    feedbackUI: null,
    container: null,

    initialize({ chatManager, feedbackUI }) {
        logger.log("INIT", "chat initializing");
        this.chatManager = chatManager;
        this.feedbackUI = feedbackUI;
        this.container = document.querySelector("#chat-messages");

        if (!this.container) {
            throw new Error("Chat messages container not found.");
        }

        this.render();

        document.addEventListener("rtg-ai:conversation-changed", () => {
            this.render();
        });
        logger.log("INIT", "chat initialized");
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
        logger.debug("CHAT", `added message ${message.id}`);
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