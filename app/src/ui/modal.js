/**
 * modal.js
 *
 * Simple accessible modal/dialog utility.
 * Creates modal overlays with focus trapping and keyboard support.
 */

const modal = {
    overlay: null,
    currentModal: null,
    previousFocus: null,
    boundKeyDown: null,
    boundFocusTrap: null,

    initialize() {
        this.createOverlay();
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundFocusTrap = this.trapFocus.bind(this);
    },

    createOverlay() {
        this.overlay = document.createElement("div");
        this.overlay.className = "modal-overlay";
        this.overlay.setAttribute("role", "dialog");
        this.overlay.setAttribute("aria-modal", "true");
        this.overlay.setAttribute("aria-hidden", "true");
        document.body.appendChild(this.overlay);
    },

    show(content, options = {}) {
        return new Promise((resolve) => {
            this.previousFocus = document.activeElement;

            const modalElement = document.createElement("div");
            modalElement.className = "modal";
            modalElement.setAttribute("role", "document");

            if (options.className) {
                modalElement.classList.add(options.className);
            }

            modalElement.innerHTML = content;

            this.overlay.innerHTML = "";
            this.overlay.appendChild(modalElement);

            this.overlay.setAttribute("aria-hidden", "false");
            this.overlay.classList.add("visible");

            document.body.classList.add("modal-open");

            document.addEventListener("keydown", this.boundKeyDown);
            document.addEventListener("focus", this.boundFocusTrap, true);

            const focusTarget = modalElement.querySelector("[autofocus]") ||
                modalElement.querySelector("button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
            focusTarget?.focus();

            this.currentModal = {
                element: modalElement,
                resolve,
                onClose: options.onClose
            };

            if (options.onShow) {
                options.onShow(modalElement);
            }
        });
    },

    close(result = null) {
        if (!this.currentModal) return;

        const { element, resolve, onClose } = this.currentModal;

        this.overlay.classList.remove("visible");
        this.overlay.setAttribute("aria-hidden", "true");

        document.body.classList.remove("modal-open");

        document.removeEventListener("keydown", this.boundKeyDown);
        document.removeEventListener("focus", this.boundFocusTrap, true);

        if (onClose) {
            onClose(result);
        }

        resolve(result);

        setTimeout(() => {
            this.overlay.innerHTML = "";
        }, 200);

        this.previousFocus?.focus();
        this.currentModal = null;
    },

    handleKeyDown(event) {
        if (!this.currentModal) return;

        if (event.key === "Escape") {
            event.preventDefault();
            this.close(false);
            return;
        }

        if (event.key === "Tab") {
            this.trapFocus(event);
        }

        if (event.key === "Enter" && event.target.matches("input[type='text'], input[type='number']")) {
            const confirmButton = this.currentModal.element.querySelector("[data-modal-confirm]");
            if (confirmButton && !event.shiftKey) {
                event.preventDefault();
                confirmButton.click();
            }
        }
    },

    trapFocus(event) {
        if (!this.currentModal) return;

        const modalElement = this.currentModal.element;
        const focusableElements = modalElement.querySelectorAll(
            "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    },

    confirm(options = {}) {
        const {
            title = "",
            message = "",
            confirmText = "Yes",
            cancelText = "No",
            danger = false,
            icon = null
        } = options;

        const iconHtml = icon ? `<div class="modal-icon">${icon}</div>` : "";
        const dangerClass = danger ? "modal-danger" : "";

        const content = `
            <div class="modal-content ${dangerClass}">
                ${iconHtml}
                ${title ? `<h2 class="modal-title">${title}</h2>` : ""}
                ${message ? `<p class="modal-message">${message}</p>` : ""}
                <div class="modal-actions">
                    <button type="button" class="modal-button modal-button-cancel" data-modal-cancel>
                        ${cancelText}
                    </button>
                    <button type="button" class="modal-button modal-button-confirm ${danger ? "danger" : ""}" data-modal-confirm autofocus>
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        return this.show(content).then((result) => {
            if (result === true) return true;
            return false;
        });
    },

    prompt(options = {}) {
        const {
            title = "",
            message = "",
            placeholder = "",
            inputType = "text",
            confirmText = "Confirm",
            cancelText = "Cancel",
            validate = null,
            errorMessage = "",
            autofocus = true
        } = options;

        let inputId = `modal-prompt-input-${Date.now()}`;

        const content = `
            <div class="modal-content modal-prompt">
                ${title ? `<h2 class="modal-title">${title}</h2>` : ""}
                ${message ? `<p class="modal-message">${message}</p>` : ""}
                <div class="modal-input-wrapper">
                    <input
                        type="${inputType}"
                        id="${inputId}"
                        class="modal-input"
                        placeholder="${placeholder}"
                        ${autofocus ? "autofocus" : ""}
                        autocomplete="off"
                        spellcheck="false"
                    >
                    ${errorMessage ? `<p class="modal-error" aria-live="polite"></p>` : ""}
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-button modal-button-cancel" data-modal-cancel>
                        ${cancelText}
                    </button>
                    <button type="button" class="modal-button modal-button-confirm" data-modal-confirm disabled>
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        return this.show(content, {
            onShow: (modalElement) => {
                const input = modalElement.querySelector(`#${inputId}`);
                const confirmButton = modalElement.querySelector("[data-modal-confirm]");
                const errorElement = modalElement.querySelector(".modal-error");

                const checkInput = () => {
                    const value = input.value;
                    let isValid = true;
                    let error = "";

                    if (validate) {
                        const validation = validate(value);
                        isValid = validation === true;
                        error = isValid ? "" : (validation || errorMessage);
                    } else {
                        isValid = value.trim().length > 0;
                        error = isValid ? "" : errorMessage;
                    }

                    confirmButton.disabled = !isValid;
                    if (errorElement) {
                        errorElement.textContent = error;
                    }
                };

                input.addEventListener("input", checkInput);
                input.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && !confirmButton.disabled) {
                        e.preventDefault();
                        confirmButton.click();
                    }
                });

                checkInput();
            }
        }).then((result) => {
            if (result === true) {
                const input = this.currentModal?.element?.querySelector(`#${inputId}`);
                return input?.value ?? "";
            }
            return null;
        });
    }
};

export { modal };