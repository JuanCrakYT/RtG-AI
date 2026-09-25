import { logger } from "../core/log.js";

const feedbackUI = {
    feedback: null,
    chatManager: null,

    initialize({ feedback, chatManager }) {
        this.feedback = feedback;
        this.chatManager = chatManager;
    },

    handle({ message, rating }) {
        if (!this.feedback || !this.chatManager) return;

        const conversation = this.chatManager.getCurrentConversation();
        if (!conversation) return;

        logger.log("FEEDBACK", `rating=${rating} for message ${message.id}`);

        this.feedback.submit({
            conversationId: conversation.id,
            messageId: message.id,
            rating
        });

        message.feedback = rating;

        const messageElement = document.querySelector(
            `[data-message-id="${CSS.escape(message.id)}"]`
        );

        if (messageElement) {
            const upButton = messageElement.querySelector(
                '.feedback-button[aria-label="Positiva"]'
            );
            const downButton = messageElement.querySelector(
                '.feedback-button[aria-label="Negativa"]'
            );

            if (upButton) {
                upButton.classList.toggle("active", rating === 1);
            }
            if (downButton) {
                downButton.classList.toggle("active", rating === -1);
            }
        }
    }
};

export { feedbackUI };