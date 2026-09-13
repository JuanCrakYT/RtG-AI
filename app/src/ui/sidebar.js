const sidebar = {
    chatManager: null,
    listElement: null,
    newChatButton: null,
    toggleButton: null,
    showButton: null,
    overlayElement: null,
    sidebarElement: null,
    resizerElement: null,

    isHidden: false,

    MOBILE_BREAKPOINT: 720,

    MIN_WIDTH: 180,
    MAX_WIDTH: 420,

    currentWidth: null,
    resizeState: null,
    boundResizeMove: null,
    boundResizeEnd: null,

    initialize({ chatManager }) {
        this.chatManager = chatManager;

        this.listElement = document.querySelector("#conversation-list");
        this.newChatButton = document.querySelector("#new-chat-button");
        this.toggleButton = document.querySelector("#toggle-sidebar-button");
        this.showButton = document.querySelector("#show-sidebar-button");
        this.overlayElement = document.querySelector("#sidebar-overlay");
        this.sidebarElement = document.querySelector("#sidebar");
        this.resizerElement = document.querySelector("#sidebar-resizer");

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

        if (!this.resizerElement) {
            throw new Error("Sidebar resizer not found.");
        }

        this.restoreWidth();
        this.bindEvents();
        this.bindResizerEvents();
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
    },

    /* =========================================================
       Sidebar resize
       ========================================================= */

    STORAGE_KEY: "rtg-ai:sidebar-width",

    restoreWidth() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored !== null) {
                const parsed = Number.parseInt(stored, 10);
                if (Number.isFinite(parsed)) {
                    this.currentWidth = this.clampWidth(parsed);
                    this.applyWidth();
                    return;
                }
            }
        } catch (error) {
            // localStorage may be unavailable; ignore and use default.
        }

        this.currentWidth = null;
        this.applyWidth();
    },

    clampWidth(width) {
        if (!Number.isFinite(width)) {
            return this.MIN_WIDTH;
        }

        return Math.max(this.MIN_WIDTH, Math.min(this.MAX_WIDTH, width));
    },

    applyWidth() {
        if (!this.sidebarElement) return;

        if (this.currentWidth === null) {
            this.sidebarElement.style.width = "";
            this.sidebarElement.style.flexBasis = "";
            return;
        }

        const width = this.clampWidth(this.currentWidth);
        this.sidebarElement.style.width = `${width}px`;
        this.sidebarElement.style.flexBasis = `${width}px`;
    },

    persistWidth() {
        if (this.currentWidth === null) return;

        try {
            localStorage.setItem(
                this.STORAGE_KEY,
                String(this.clampWidth(this.currentWidth))
            );
        } catch (error) {
            // Ignore storage errors.
        }
    },

    bindResizerEvents() {
        if (!this.resizerElement) return;

        this.resizerElement.addEventListener("mousedown", (event) => {
            this.startResize(event);
        });

        this.resizerElement.addEventListener("keydown", (event) => {
            this.handleResizeKey(event);
        });

        this.resizerElement.addEventListener("dblclick", () => {
            this.currentWidth = null;
            this.applyWidth();
            this.persistWidth();
        });
    },

    startResize(event) {
        if (this.isMobile()) return;

        event.preventDefault();

        this.resizeState = {
            startX: event.clientX,
            startWidth: this.currentWidth ?? this.getDefaultWidth()
        };

        this.boundResizeMove = this.onResizeMove.bind(this);
        this.boundResizeEnd = this.onResizeEnd.bind(this);

        document.addEventListener("mousemove", this.boundResizeMove);
        document.addEventListener("mouseup", this.boundResizeEnd);

        document.body.classList.add("sidebar-resizing");
        this.resizerElement.classList.add("is-dragging");
    },

    onResizeMove(event) {
        if (!this.resizeState) return;

        const delta = event.clientX - this.resizeState.startX;
        const newWidth = this.resizeState.startWidth + delta;

        this.currentWidth = this.clampWidth(newWidth);
        this.applyWidth();
    },

    onResizeEnd() {
        if (!this.resizeState) return;

        this.resizeState = null;

        if (this.boundResizeMove) {
            document.removeEventListener("mousemove", this.boundResizeMove);
        }

        if (this.boundResizeEnd) {
            document.removeEventListener("mouseup", this.boundResizeEnd);
        }

        document.body.classList.remove("sidebar-resizing");
        this.resizerElement.classList.remove("is-dragging");

        this.persistWidth();
    },

    handleResizeKey(event) {
        if (this.isMobile()) return;

        const step = 10;
        const current = this.currentWidth ?? this.getDefaultWidth();

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            this.currentWidth = this.clampWidth(current - step);
            this.applyWidth();
            this.persistWidth();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            this.currentWidth = this.clampWidth(current + step);
            this.applyWidth();
            this.persistWidth();
        } else if (event.key === "Home") {
            event.preventDefault();
            this.currentWidth = this.MIN_WIDTH;
            this.applyWidth();
            this.persistWidth();
        } else if (event.key === "End") {
            event.preventDefault();
            this.currentWidth = this.MAX_WIDTH;
            this.applyWidth();
            this.persistWidth();
        }
    },

    getDefaultWidth() {
        const sidebarWidth = getComputedStyle(this.sidebarElement).width;
        const parsed = Number.parseInt(sidebarWidth, 10);
        return Number.isFinite(parsed) ? parsed : 250;
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
    }
};

export { sidebar };