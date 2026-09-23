import { ai } from "./core/ai.js";
import { chatManager } from "./core/chatManager.js";
import { feedback } from "./core/feedback.js";
import { modelManager } from "./core/modelManager.js";
import { storage } from "./core/storage.js";

import { chat } from "./ui/chat.js";
import { developer } from "./ui/developer.js";
import { feedbackUI } from "./ui/feedback.js";
import { input } from "./ui/input.js";
import { lang } from "./ui/lang.js";
import { modelSelector } from "./ui/modelSelector.js";
import { preview } from "./ui/preview.js";
import { settings } from "./ui/settings.js";
import { sidebar } from "./ui/sidebar.js";
import { suggested } from "./ui/suggested.js";


/**
 * RtG-AI application entry point.
 *
 * main.js is responsible for initializing the application
 * and connecting the core and UI modules.
 */

async function initialize() {
    console.log("RtG-AI starting...");

    await storage.initialize();
    await modelManager.initialize();
    await chatManager.initialize();

    await lang.initialize();
    lang.applyToDocument();

    modelSelector.initialize({
        modelManager
    });

    sidebar.initialize({
        chatManager
    });

    chat.initialize({
        chatManager,
        feedbackUI
    });

    input.initialize({
        ai,
        chatManager,
        modelManager,
        chat,
        preview
    });

    suggested.initialize({
        input
    });

    feedbackUI.initialize({
        feedback,
        chatManager
    });

    preview.initialize({
        lang
    });

    settings.initialize({
        lang,
        modelManager,
        chatManager,
        sidebar
    });

    developer.initialize({});

    // Wire up JSON drawer
    const viewJsonButton = document.querySelector("#view-json-button");
    const jsonDrawer = document.querySelector("#json-drawer");
    const closeJsonButton = document.querySelector("#close-json-button");

    if (viewJsonButton && jsonDrawer && closeJsonButton) {
        viewJsonButton.addEventListener("click", () => {
            jsonDrawer.classList.add("open");
            jsonDrawer.setAttribute("aria-hidden", "false");
        });

        closeJsonButton.addEventListener("click", () => {
            jsonDrawer.classList.remove("open");
            jsonDrawer.setAttribute("aria-hidden", "true");
        });
    }

    // Wire up Preview drawer
    const viewPreviewButton = document.querySelector("#view-preview-button");
    if (viewPreviewButton) {
        viewPreviewButton.addEventListener("click", () => {
            preview.show();
        });
    }

    // Wire up Settings drawer
    const settingsButton = document.querySelector("#settings-button");
    const closeSettingsButton = document.querySelector("#close-settings-button");
    const settingsDrawer = document.querySelector("#settings-drawer");

    if (settingsButton && settingsDrawer && closeSettingsButton) {
        settingsButton.addEventListener("click", () => {
            settings.show();
        });

        closeSettingsButton.addEventListener("click", () => {
            settings.hide();
        });

        // Close on click outside
        settingsDrawer.addEventListener("click", (event) => {
            if (event.target === settingsDrawer) {
                settings.hide();
            }
        });
    }

    // Wire up Developer drawer
    const developerButton = document.querySelector("#developer-button");
    const closeDeveloperButton = document.querySelector("#close-developer-button");
    const developerDrawer = document.querySelector("#developer-drawer");

    if (developerButton && developerDrawer && closeDeveloperButton) {
        developerButton.addEventListener("click", () => {
            developer.show();
        });

        closeDeveloperButton.addEventListener("click", () => {
            developer.hide();
        });

        // Close on click outside
        developerDrawer.addEventListener("click", (event) => {
            if (event.target === developerDrawer) {
                developer.hide();
            }
        });
    }

    await chatManager.loadCurrentConversation();

    // Show/hide quick prompts based on conversation state
    const conversation = chatManager.getCurrentConversation();
    if (!conversation || conversation.messages.length === 0) {
        input.showQuickPrompts();
    } else {
        input.hideQuickPrompts();
    }

    // Listen for conversation changes to toggle quick prompts
    document.addEventListener("rtg-ai:conversation-changed", () => {
        const conv = chatManager.getCurrentConversation();
        if (!conv || conv.messages.length === 0) {
            input.showQuickPrompts();
        } else {
            input.hideQuickPrompts();
        }
    });

    console.log("RtG-AI ready.");
}


/**
 * Start the application.
 */

initialize().catch((error) => {
    console.error("Failed to initialize RtG-AI:", error);

    document.body.classList.add("app-error");
});