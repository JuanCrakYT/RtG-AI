function createMessageElement(message, options = {}) {
    const {
        onFeedback = null
    } = options;

    const element = document.createElement("article");

    element.className = `message message-${message.role}`;
    element.dataset.messageId = message.id ?? "";

    const header = document.createElement("div");
    header.className = "message-header";

    const role = document.createElement("span");
    role.className = "message-role";
    role.textContent = getRoleLabel(message.role);

    header.appendChild(role);

    const content = document.createElement("div");
    content.className = "message-content";

    renderContent(content, message.content ?? "");

    element.appendChild(header);
    element.appendChild(content);

    /*
     * Assistant messages can receive feedback.
     */
    if (message.role === "assistant" && onFeedback) {
        const feedback = createFeedbackButtons(
            message,
            onFeedback
        );

        element.appendChild(feedback);
    }

    return element;
}


function getRoleLabel(role) {
    switch (role) {
        case "user":
            return "Tú";

        case "assistant":
            return "RtG-AI";

        case "system":
            return "Sistema";

        default:
            return role ?? "Mensaje";
    }
}


function renderContent(container, content) {
    const text = String(content);

    /*
     * Split fenced code blocks from normal text.
     *
     * Example:
     *
     * ```json
     * [...]
     * ```
     */
    const parts = text.split(/(```[\s\S]*?```)/g);

    for (const part of parts) {
        if (!part) {
            continue;
        }

        if (part.startsWith("```") && part.endsWith("```")) {
            renderCodeBlock(container, part);
        } else {
            renderText(container, part);
        }
    }
}


function renderText(container, text) {
    const lines = text.split("\n");

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];

        if (line.trim()) {
            const paragraph = document.createElement("p");

            paragraph.textContent = line;

            container.appendChild(paragraph);
        }

        if (
            index < lines.length - 1 &&
            line.trim()
        ) {
            const spacer = document.createElement("span");

            spacer.className = "message-line-break";

            container.appendChild(spacer);
        }
    }
}


function renderCodeBlock(container, fencedCode) {
    const lines = fencedCode.split("\n");

    /*
     * Remove opening and closing fences.
     */
    const opening = lines.shift() ?? "";

    if (lines.at(-1)?.trim() === "```") {
        lines.pop();
    }

    const language =
        opening
            .replace(/^```/, "")
            .trim()
            .toLowerCase();

    const code = lines.join("\n");

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";

    if (language) {
        wrapper.dataset.language = language;
    }

    const copyButton = document.createElement("button");

    copyButton.type = "button";
    copyButton.className = "code-copy-button";
    copyButton.textContent = "Copiar";

    copyButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(code);

            copyButton.textContent = "Copiado";

            setTimeout(() => {
                copyButton.textContent = "Copiar";
            }, 1200);
        } catch (error) {
            console.error(
                "Failed to copy code:",
                error
            );
        }
    });

    const pre = document.createElement("pre");
    const codeElement = document.createElement("code");

    codeElement.textContent = code;

    pre.appendChild(codeElement);

    wrapper.appendChild(copyButton);
    wrapper.appendChild(pre);

    container.appendChild(wrapper);
}


function createFeedbackButtons(message, onFeedback) {
    const container = document.createElement("div");

    container.className = "message-feedback";

    const upButton = createFeedbackButton(
        "👍",
        "Positiva",
        message.feedback === 1
    );

    const downButton = createFeedbackButton(
        "👎",
        "Negativa",
        message.feedback === -1
    );

    upButton.addEventListener("click", () => {
        onFeedback(message, 1);
    });

    downButton.addEventListener("click", () => {
        onFeedback(message, -1);
    });

    container.appendChild(upButton);
    container.appendChild(downButton);

    return container;
}


function createFeedbackButton(
    icon,
    label,
    active
) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "feedback-button";

    if (active) {
        button.classList.add("active");
    }

    button.textContent = icon;
    button.title = label;
    button.setAttribute(
        "aria-label",
        label
    );

    return button;
}


export {
    createMessageElement
};