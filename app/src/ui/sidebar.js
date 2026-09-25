import { modal } from "./modal.js";
import { lang } from "./lang.js";

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

    isMobile() {
        return window.innerWidth <= this.MOBILE_BREAKPOINT;
    },

    MIN_WIDTH: 200,
    MAX_WIDTH: 360,

    currentWidth: null,
    resizeState: null,
    boundResizeMove: null,
    boundResizeEnd: null,

    // Drag/swipe state
    dragState: null,
    boundDragMove: null,
    boundDragEnd: null,

    DELETE_THRESHOLD: 100,

    initialize({ chatManager }) {
        this.chatManager = chatManager;

        this.listElement = document.querySelector("#conversation-list");
        this.newChatButton = document.querySelector("#new-chat");
        this.newChatTrigger = document.querySelector(".new-chat-trigger");
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

        modal.initialize();

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

    /* =========================================================
       Sidebar visibility
       ========================================================= */

    updateAria() {
        if (!this.sidebarElement) return;

        this.sidebarElement.setAttribute(
            "aria-hidden",
            String(this.isHidden)
        );
    },

    updateToggleLabel() {
        if (!this.toggleButton) return;

        const isHidden = this.isHidden;

        this.toggleButton.setAttribute(
            "aria-label",
            isHidden ? "Mostrar conversaciones" : "Ocultar conversaciones"
        );
        this.toggleButton.setAttribute(
            "title",
            isHidden ? "Mostrar conversaciones" : "Ocultar conversaciones"
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
        document.getElementById("app")?.classList.remove("sidebar-collapsed");

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
        document.getElementById("app")?.classList.add("sidebar-collapsed");

        this.overlayElement.classList.remove("is-visible");
        this.overlayElement.setAttribute("aria-hidden", "true");

        this.updateAria();
        this.updateToggleLabel();
    },

    /* =========================================================
       Drag/Swipe to delete
       ========================================================= */

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

        // Delete hint element
        const deleteHint = document.createElement("div");
        deleteHint.className = "conversation-delete-hint";
        deleteHint.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span data-i18n="delete-chat_ask">${lang.t("delete-chat_ask")}</span>
        `;
        item.appendChild(deleteHint);

        item.appendChild(button);

        // Bind drag events for swipe-to-delete
        this.bindDragEvents(item, conversation);

        return item;
    },

    bindDragEvents(item, conversation) {
        const button = item.querySelector(".conversation-button");

        const onPointerDown = (event) => {
            // Only handle primary pointer (left click / touch)
            if (event.button !== 0 && event.pointerType !== "touch") return;

            // Ignore if target is the button but it's a click (will be handled by click)
            // We need to distinguish between click and drag
            this.dragState = {
                conversationId: conversation.id,
                item,
                button,
                startX: event.clientX,
                startY: event.clientY,
                currentX: event.clientX,
                isDragging: false,
                hasMoved: false,
                startTime: Date.now()
            };

            this.boundDragMove = this.onDragMove.bind(this);
            this.boundDragEnd = this.onDragEnd.bind(this);

            document.addEventListener("pointermove", this.boundDragMove);
            document.addEventListener("pointerup", this.boundDragEnd);
            document.addEventListener("pointercancel", this.boundDragEnd);

            // Capture pointer to continue receiving events
            item.setPointerCapture(event.pointerId);

            // Prevent text selection during drag
            event.preventDefault();
        };

        const onClick = (event) => {
            // If we dragged, don't trigger click
            if (this.dragState?.hasMoved) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            // Normal click - let the button's click handler handle it
        };

        item.addEventListener("pointerdown", onPointerDown);
        button.addEventListener("click", onClick);

        // Store handlers for cleanup if needed
        item._dragHandlers = { onPointerDown, onClick };
    },

    onDragMove(event) {
        if (!this.dragState) return;

        const { item, startX, startY } = this.dragState;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;

        // Check if it's a horizontal drag (swipe right) vs vertical scroll
        const isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10;

        if (isHorizontalDrag) {
            event.preventDefault();

            if (!this.dragState.isDragging) {
                this.dragState.isDragging = true;
                item.classList.add("dragging");
                document.body.style.userSelect = "none";
            }

            this.dragState.hasMoved = true;
            this.dragState.currentX = event.clientX;

            // Only allow rightward drag (positive deltaX)
            const translateX = Math.max(0, deltaX);
            item.style.transform = `translateX(${translateX}px)`;

            // Show delete ready state when threshold reached
            if (translateX >= this.DELETE_THRESHOLD) {
                item.classList.add("swipe-delete-ready");
            } else {
                item.classList.remove("swipe-delete-ready");
            }
        } else if (!this.dragState.isDragging && Math.abs(deltaY) > 10) {
            // Vertical scroll - cancel drag
            this.cancelDrag();
        }
    },

    onDragEnd(event) {
        if (!this.dragState) return;

        const { item, conversationId, isDragging, currentX, startX } = this.dragState;
        const deltaX = currentX - startX;

        // Clean up
        document.removeEventListener("pointermove", this.boundDragMove);
        document.removeEventListener("pointerup", this.boundDragEnd);
        document.removeEventListener("pointercancel", this.boundDragEnd);

        try {
            item.releasePointerCapture(event.pointerId);
        } catch (e) {
            // Ignore
        }

        document.body.style.userSelect = "";

        item.classList.remove("dragging");

        if (isDragging && deltaX >= this.DELETE_THRESHOLD) {
            // Trigger delete confirmation flow
            item.classList.remove("swipe-delete-ready");
            item.style.transform = "";
            this.confirmDeleteConversation(conversationId);
        } else {
            // Animate back to original position
            item.style.transition = "transform var(--transition-fast)";
            item.style.transform = "";
            item.classList.remove("swipe-delete-ready");

            setTimeout(() => {
                item.style.transition = "";
            }, 200);
        }

        this.dragState = null;
    },

    cancelDrag() {
        if (!this.dragState) return;

        const { item } = this.dragState;

        document.removeEventListener("pointermove", this.boundDragMove);
        document.removeEventListener("pointerup", this.boundDragEnd);
        document.removeEventListener("pointercancel", this.boundDragEnd);

        document.body.style.userSelect = "";

        item.classList.remove("dragging");
        item.style.transition = "transform var(--transition-fast)";
        item.style.transform = "";
        item.classList.remove("swipe-delete-ready");

        setTimeout(() => {
            item.style.transition = "";
        }, 200);

        this.dragState = null;
    },

    async confirmDeleteConversation(conversationId) {
        const conversation = this.chatManager.conversations.find((c) => c.id === conversationId);
        if (!conversation) return;

        const messageCount = conversation.messages.length;

        // First confirmation: Yes/No
        const confirmed = await modal.confirm({
            title: lang.t("delete-chat_ask"),
            message: lang.t("delete-chat_undone"),
            confirmText: lang.t("delete-chat_yes"),
            cancelText: lang.t("delete-chat_no"),
            danger: true,
            icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`
        });

        if (!confirmed) {
            return;
        }

        // Second confirmation: type message count
        const writeLeft = lang.t("delete-chat_write-left");
        const writeRight = lang.t("delete-chat_write-right");
        const mismatchMessage = lang.t("delete-chat_mismatch");

        const inputResult = await modal.prompt({
            title: lang.t("delete-chat_ask"),
            message: `${writeLeft}<strong>${messageCount}</strong>${writeRight}`,
            placeholder: String(messageCount),
            inputType: "number",
            confirmText: lang.t("delete-chat_yes"),
            cancelText: lang.t("delete-chat_cancel"),
            validate: (value) => {
                const num = parseInt(value, 10);
                if (Number.isNaN(num)) return mismatchMessage;
                return num === messageCount;
            },
            errorMessage: mismatchMessage
        });

        if (inputResult === null) {
            // User cancelled
            return;
        }

        // User entered correct number - delete the conversation
        this.deleteConversation(conversationId);
    },

    deleteConversation(conversationId) {
        const wasCurrent = this.chatManager.currentConversationId === conversationId;
        const deleted = this.chatManager.deleteConversation(conversationId);

        if (deleted) {
            this.render();

            // If the deleted conversation was the current one, notify about change
            if (wasCurrent) {
                const newCurrent = this.chatManager.getCurrentConversation();
                if (newCurrent) {
                    this.dispatchConversationChanged(newCurrent);
                }
            }
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

        // Delete hint element
        const deleteHint = document.createElement("div");
        deleteHint.className = "conversation-delete-hint";
        deleteHint.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span data-i18n="delete-chat_ask">${lang.t("delete-chat_ask")}</span>
        `;
        item.appendChild(deleteHint);

        item.appendChild(button);

        // Bind drag events for swipe-to-delete
        this.bindDragEvents(item, conversation);

        return item;
    },

    createConversation() {
        const conversation =
            this.chatManager.createConversation();

        this.render();

        this.dispatchConversationChanged(conversation);

        this.focusInput();
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