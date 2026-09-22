const sidebar = {
    chatManager: null,
    listElement: null,
    newChatButton: null,
    newChatTrigger: null,
    toggleButton: null,
    showButton: null,
    overlayElement: null,
    sidebarElement: null,
    resizerElement: null,
    settingsButton: null,
    themeButton: null,

    isHidden: false,

    MOBILE_BREAKPOINT: 768,

    MIN_WIDTH: 200,
    MAX_WIDTH: 360,

    currentWidth: null,
    resizeState: null,
    boundResizeMove: null,
    boundResizeEnd: null,

    initialize({ chatManager }) {
        this.chatManager = chatManager;

        this.listElement = document.querySelector("#conversation-list");
        this.newChatButton = document.querySelector("#new-chat");
        this.newChatTrigger = document.querySelector("#new-chat-trigger");
        this.toggleButton = document.querySelector("#toggle-sidebar-button");
        this.showButton = document.querySelector("#show-sidebar-button");
        this.overlayElement = document.querySelector("#sidebar-overlay");
        this.sidebarElement = document.querySelector("#sidebar");
        this.resizerElement = document.querySelector("#sidebar-resizer");
        this.settingsButton = document.querySelector("#settings-button");
        this.themeButton = document.querySelector("#toggle-theme-button");

        if (!this.listElement) {
            throw new Error("Conversation list not found.");
        }

        if (!this.newChatButton) {
            throw new Error("New chat button not found.");
        }

        if (!this.newChatTrigger) {
            throw new Error("New chat trigger not found.");
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

        if (!this.settingsButton) {
            throw new Error("Settings button not found.");
        }

        if (!this.themeButton) {
            throw new Error("Theme button not found.");
        }

        this.restoreWidth();
        this.bindEvents();
        this.bindResizerEvents();
        this.applyResponsiveState();
        this.render();
        this.applyTheme();

        window.addEventListener("resize", () => {
            this.applyResponsiveState();
        });
    },

    bindEvents() {
        this.newChatButton.addEventListener("click", () => {
            this.createConversation();
        });

        this.newChatTrigger.addEventListener("click", () => {
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

        this.settingsButton.addEventListener("click", () => {
            this.openSettings();
        });

        this.themeButton.addEventListener("click", () => {
            this.toggleTheme();
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

        this.toggleButton.innerHTML = isHidden
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

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
       Theme handling
       ========================================================= */

    applyTheme() {
        const savedTheme = localStorage.getItem("rtg-ai:theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = savedTheme || (prefersDark ? "dark" : "light");

        document.documentElement.setAttribute("data-theme", theme);
        this.updateThemeIcon(theme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("rtg-ai:theme", newTheme);
        this.updateThemeIcon(newTheme);
    },

    updateThemeIcon(theme) {
        if (!this.themeButton) return;

        const sunIcon = this.themeButton.querySelector(".icon-sun");
        const moonIcon = this.themeButton.querySelector(".icon-moon");

        if (theme === "dark") {
            sunIcon.style.display = "block";
            moonIcon.style.display = "none";
            this.themeButton.setAttribute("aria-label", "Cambiar a tema claro");
        } else {
            sunIcon.style.display = "none";
            moonIcon.style.display = "block";
            this.themeButton.setAttribute("aria-label", "Cambiar a tema oscuro");
        }
    },

    openSettings() {
        document.dispatchEvent(
            new CustomEvent("rtg-ai:settings-requested")
        );
    },

    /* =========================================================
       Sidebar resize (pointer events for robustness)
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

        // Use pointer events for better cross-device support
        this.resizerElement.addEventListener("pointerdown", (event) => {
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

        // Prevent text selection during resize
        this.resizerElement.addEventListener("selectstart", (event) => {
            event.preventDefault();
        });
    },

    startResize(event) {
        if (this.isMobile()) return;

        // Only handle primary pointer (mouse/touch)
        if (event.button !== 0 && event.pointerType !== "touch") return;

        event.preventDefault();

        // Capture pointer to continue receiving events even if cursor leaves resizer
        this.resizerElement.setPointerCapture(event.pointerId);

        this.resizeState = {
            startX: event.clientX,
            startWidth: this.currentWidth ?? this.getDefaultWidth()
        };

        this.boundResizeMove = this.onResizeMove.bind(this);
        this.boundResizeEnd = this.onResizeEnd.bind(this);

        document.addEventListener("pointermove", this.boundResizeMove);
        document.addEventListener("pointerup", this.boundResizeEnd);
        document.addEventListener("pointercancel", this.boundResizeEnd);

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

    onResizeEnd(event) {
        if (!this.resizeState) return;

        this.resizeState = null;

        if (this.boundResizeMove) {
            document.removeEventListener("pointermove", this.boundResizeMove);
        }

        if (this.boundResizeEnd) {
            document.removeEventListener("pointerup", this.boundResizeEnd);
            document.removeEventListener("pointercancel", this.boundResizeEnd);
        }

        // Release pointer capture
        try {
            this.resizerElement.releasePointerCapture(event.pointerId);
        } catch (e) {
            // Ignore if capture was already released
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
        return Number.isFinite(parsed) ? parsed : 260;
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