import { storage } from "./storage.js";

const STORAGE_KEY = "rtg-ai:conversations";
const CURRENT_KEY = "rtg-ai:current-conversation";

const chatManager = {
    conversations: [],
    currentConversationId: null,

    async initialize() {
        await storage.initialize();
        await this.loadConversations();
    },

    async loadConversations() {
        try {
            const data = await storage.get(STORAGE_KEY);
            this.conversations = data ?? [];

            const currentId = await storage.get(CURRENT_KEY);
            this.currentConversationId = currentId ?? null;

            if (!this.currentConversationId && this.conversations.length > 0) {
                this.currentConversationId = this.conversations[0].id;
                await this.saveCurrent();
            }
        } catch (error) {
            console.error("Failed to load conversations:", error);
            this.conversations = [];
            this.currentConversationId = null;
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

        return conversation;
    },

    async selectConversation(conversationId) {
        const conversation = this.conversations.find((c) => c.id === conversationId);
        if (!conversation) return null;

        this.currentConversationId = conversationId;
        await this.saveCurrent();
        this.notifyUpdate();

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
    }
};

export { chatManager };