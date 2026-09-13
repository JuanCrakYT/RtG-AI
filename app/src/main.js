import { ai } from "./core/ai.js";
import { chatManager } from "./core/chatManager.js";
import { feedback } from "./core/feedback.js";
import { modelManager } from "./core/modelManager.js";
import { storage } from "./core/storage.js";

import { chat } from "./ui/chat.js";
import { feedbackUI } from "./ui/feedback.js";
import { input } from "./ui/input.js";
import { lang } from "./ui/lang.js";
import { modelSelector } from "./ui/modelSelector.js";
import { preview } from "./ui/preview.js";
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

    await chatManager.loadCurrentConversation();

    console.log("RtG-AI ready.");
}


/**
 * Start the application.
 */

initialize().catch((error) => {
    console.error("Failed to initialize RtG-AI:", error);

    document.body.classList.add("app-error");
});