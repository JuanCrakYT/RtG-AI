const sidebar = {
    chatManager: null,
    listElement: null,
    newChatButton: null,
    toggleButton: null,
    showButton: null,
    overlayElement: null,
    sidebarElement: null,

    isHidden: false,

    MOBILE_BREAKPOINT: 720,

    initialize({ chatManager }) {
        this.chatManager = chatManager;

        this.listElement = document.querySelector("#conversation-list");
        this.newChatButton = document.querySelector("#new-chat-button");
        this.toggleButton = document.querySelector("#toggle-sidebar-button");
        this.showButton = document.querySelector("#show-sidebar-button");
        this.overlayElement = document.querySelector("#sidebar-overlay");
        this.sidebarElement = document.querySelector("#sidebar");

        if (!this.listElement) {
            throw new Error("Conversation list not found.");
        }

        if (!this.newChatButton) {
            throw new Error("New chat button not found.");
        }

        if (!this.toggleButton) {
            throw new Error("Toggle sidebar button not found.");
        }

        if (!this.showButton) {
            throw new Error("Show sidebar button not found.");
        }

        if (!this.overlayElement) {
            throw new Error("Sidebar overlay not found.");
        }

        if (!this.sidebarElement) {
            throw new Error("Sidebar element not found.");
        }

        this.bindEvents();
        this.applyResponsiveState();
        this.render();

        window.addEventListener("resize", () => {
            this.applyResponsiveState();
        });
    },

    bindEvents() {
        this.newChatButton.addEventListener("click", () => {
            this.createConversation();
        });

        this.toggleButton.addEventListener("click", () => {
            this.toggle();
        });

        this.showButton.addEventListener("click", () => {
            this.show();
        });

        this.overlayElement.addEventListener("click", () => {
            this.hide();
        });

        document.addEventListener("rtg-ai:conversation-updated", () => {
            this.render();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            if (this.isMobile() && !this.isHidden) {
                this.hide();
            }
        });
    },

    isMobile() {
        return window.innerWidth <= this.MOBILE_BREAKPOINT;
    },

    applyResponsiveState() {
        if (this.isMobile()) {
            this.sidebarElement.classList.add("is-overlay");

            if (this.isHidden) {
                this.sidebarElement.classList.add("is-hidden");
            } else {
                this.sidebarElement.classList.remove("is-hidden");
            }

            this.overlayElement.classList.remove("is-visible");
            this.overlayElement.setAttribute("aria-hidden", "true");

            this.updateAria();
            this.updateToggleLabel();
            return;
        }

        this.sidebarElement.classList.remove("is-overlay");

        if (this.isHidden) {
            this.sidebarElement.classList.add("is-hidden");
        } else {
            this.sidebarElement.classList.remove("is-hidden");
        }

        this.overlayElement.classList.remove("is-visible");
        this.overlayElement.setAttribute("aria-hidden", "true");

        this.updateAria();
        this.updateToggleLabel();
    },

    updateAria() {
        if (!this.sidebarElement) return;

        this.sidebarElement.setAttribute(
            "aria-hidden",
            String(this.isHidden)
        );
    },

    toggle() {
        if (this.isHidden) {
            this.show();
        } else {
            this.hide();
        }
    },

    show() {
        this.isHidden = false;
        this.sidebarElement.classList.remove("is-hidden");

        if (this.isMobile()) {
            this.overlayElement.classList.add("is-visible");
            this.overlayElement.setAttribute("aria-hidden", "false");
        }

        this.updateAria();
        this.updateToggleLabel();
    },

    hide() {
        this.isHidden = true;
        this.sidebarElement.classList.add("is-hidden");

        this.overlayElement.classList.remove("is-visible");
        this.overlayElement.setAttribute("aria-hidden", "true");

        this.updateAria();
        this.updateToggleLabel();
    },

    updateToggleLabel() {
        if (!this.toggleButton) return;

        const isHidden = this.isHidden;

        this.toggleButton.textContent = isHidden ? "☰" : "×";
        this.toggleButton.setAttribute(
            "aria-label",
            isHidden ? "Mostrar conversaciones" : "Ocultar conversaciones"
        );
        this.toggleButton.setAttribute(
            "title",
            isHidden ? "Mostrar conversaciones" : "Ocultar conversaciones"
        );
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

        if (this.isMobile() && !this.isHidden) {
            this.hide();
        }
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