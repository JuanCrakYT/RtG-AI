import { storage } from "./storage.js";
import { logger } from "./log.js";

const STORAGE_KEY = "rtg-ai:conversations";
const CURRENT_KEY = "rtg-ai:current-conversation";

const chatManager = {
    conversations: [],
    currentConversationId: null,

    async initialize() {
        logger.log("INIT", "chatManager initializing");
        await storage.initialize();
        await this.loadConversations();
    },

    async loadConversations() {
        try {
            const data = await storage.get(STORAGE_KEY);
            this.conversations = data ?? [];

            const currentId = await storage.get(CURRENT_KEY);
            this.currentConversationId = currentId ?? null;

            this.cleanupEmptyConversations();

            if (!this.currentConversationId && this.conversations.length > 0) {
                this.currentConversationId = this.conversations[0].id;
                await this.saveCurrent();
            } else if (this.conversations.length === 0) {
                this.createConversation();
            }
            logger.log("STORAGE", `loaded ${this.conversations.length} conversations`);
        } catch (error) {
            logger.error("STORAGE", "Failed to load conversations", error);
            this.conversations = [];
            this.currentConversationId = null;
            this.createConversation();
        }
    },

    isConversationEmpty(conversation) {
        return !conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0;
    },

    cleanupEmptyConversations() {
        const initialLength = this.conversations.length;
        this.conversations = this.conversations.filter((c) => !this.isConversationEmpty(c));

        if (this.conversations.length !== initialLength) {
            this.saveAll();
        }

        if (this.currentConversationId) {
            const currentExists = this.conversations.some((c) => c.id === this.currentConversationId);
            if (!currentExists) {
                this.currentConversationId = this.conversations[0]?.id ?? null;
            }
        }
    },

    getConversations() {
        return [...this.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getCurrentConversation() {
        if (!this.currentConversationId) return null;
        return this.conversations.find((c) => c.id === this.currentConversationId) ?? null;
    },

    createConversation() {
        const current = this.getCurrentConversation();

        if (current && this.isConversationEmpty(current)) {
            return current;
        }

        const conversation = {
            id: crypto.randomUUID(),
            title: "Nueva conversación",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.conversations.unshift(conversation);
        this.currentConversationId = conversation.id;
        this.saveAll();
        this.saveCurrent();
        this.notifyUpdate();

        logger.log("CHAT", `created conversation ${conversation.id}`);
        return conversation;
    },

    async selectConversation(conversationId) {
        const conversation = this.conversations.find((c) => c.id === conversationId);
        if (!conversation) return null;

        if (this.isConversationEmpty(conversation)) {
            this.deleteConversation(conversationId);
            return this.createConversation();
        }

        this.currentConversationId = conversationId;
        await this.saveCurrent();
        this.notifyUpdate();

        logger.log("CHAT", `selected conversation ${conversationId}`);
        return conversation;
    },

    addMessage(message) {
        const conversation = this.getCurrentConversation();
        if (!conversation) return false;

        conversation.messages.push(message);
        conversation.updatedAt = Date.now();

        if (conversation.messages.length === 1) {
            conversation.title = this.generateTitle(message.content);
        }

        this.saveAll();
        this.notifyUpdate();

        return true;
    },

    getMessages(conversationId) {
        const conversation = this.conversations.find((c) => c.id === conversationId);
        return conversation?.messages ?? [];
    },

    generateTitle(content) {
        const text = String(content).trim();
        const firstLine = text.split("\n")[0];
        const trimmed = firstLine.slice(0, 50);
        return trimmed + (text.length > 50 ? "..." : "");
    },

    async loadCurrentConversation() {
        await this.loadConversations();
        this.notifyUpdate();
    },

    notifyUpdate() {
        document.dispatchEvent(
            new CustomEvent("rtg-ai:conversation-updated")
        );
    },

    saveAll() {
        storage.set(STORAGE_KEY, this.conversations);
        logger.log("STORAGE", "saved conversations");
    },

    saveCurrent() {
        storage.set(CURRENT_KEY, this.currentConversationId);
    },

    clearAllConversations() {
        this.conversations = [];
        this.currentConversationId = null;
        this.saveAll();
        this.saveCurrent();
        this.notifyUpdate();

        // Create a new empty conversation
        this.createConversation();
    },

    deleteConversation(conversationId) {
        const index = this.conversations.findIndex((c) => c.id === conversationId);
        if (index === -1) return false;

        const wasCurrent = this.currentConversationId === conversationId;
        this.conversations.splice(index, 1);

        if (wasCurrent) {
            this.currentConversationId = this.conversations[0]?.id ?? null;
            this.saveCurrent();
        }

        this.saveAll();
        this.notifyUpdate();

        logger.log("CHAT", `deleted conversation ${conversationId}`);
        return true;
    }
};

export { chatManager };