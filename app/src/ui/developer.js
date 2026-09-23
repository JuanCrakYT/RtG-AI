const developer = {
    drawer: null,
    closeButton: null,

    initialize({}) {
        this.drawer = document.querySelector("#developer-drawer");
        this.closeButton = document.querySelector("#close-developer-button");

        if (!this.drawer) {
            throw new Error("Developer drawer not found.");
        }

        if (!this.closeButton) {
            throw new Error("Close developer button not found.");
        }

        this.bindEvents();
    },

    bindEvents() {
        this.closeButton.addEventListener("click", () => {
            this.hide();
        });

        // Close on click outside (overlay)
        this.drawer.addEventListener("click", (event) => {
            if (event.target === this.drawer) {
                this.hide();
            }
        });

        // Keyboard: Escape to close
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.isOpen()) {
                this.hide();
            }
        });
    },

    show() {
        if (!this.drawer) return;

        this.drawer.classList.add("open");
        this.drawer.setAttribute("aria-hidden", "false");

        // Focus first focusable element
        const firstFocusable = this.drawer.querySelector("button, select, [href], input, [tabindex]:not([tabindex='-1'])");
        firstFocusable?.focus();
    },

    hide() {
        if (!this.drawer) return;

        this.drawer.classList.remove("open");
        this.drawer.setAttribute("aria-hidden", "true");
    },

    isOpen() {
        return this.drawer?.classList.contains("open") ?? false;
    }
};

export { developer };