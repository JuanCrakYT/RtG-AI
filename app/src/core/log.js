/**
 * log.js
 *
 * Simple logging utility for RtG-AI.
 * Provides consistent formatted logging across all modules.
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

let currentLogLevel = LOG_LEVELS.INFO;

function formatMessage(category, message) {
    return `${category} - ${message}`;
}

function log(category, message) {
    if (LOG_LEVELS.INFO >= currentLogLevel) {
        console.log(formatMessage(category, message));
    }
}

function debug(category, message) {
    if (LOG_LEVELS.DEBUG >= currentLogLevel) {
        console.log(formatMessage(category, message));
    }
}

function warn(category, message) {
    if (LOG_LEVELS.WARN >= currentLogLevel) {
        console.warn(formatMessage(category, message));
    }
}

function error(category, message, err) {
    if (LOG_LEVELS.ERROR >= currentLogLevel) {
        const msg = formatMessage(category, message);
        if (err instanceof Error) {
            console.error(msg, err);
        } else {
            console.error(msg);
        }
    }
}

function setLogLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
        currentLogLevel = LOG_LEVELS[level];
    }
}

export const logger = {
    log,
    debug,
    warn,
    error,
    setLogLevel
};