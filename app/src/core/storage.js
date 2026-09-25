const STORAGE_PREFIX = "rtg-ai:";

import { logger } from "./log.js";

const storage = {

    async initialize() {
        /*
         * Reserved for future storage migrations.
         *
         * For example, if the structure of saved conversations
         * changes in a future version, migrations can be handled
         * here without changing the rest of the application.
         */
    },


    async get(key, fallback = null) {
        const storageKey = this.createKey(key);

        try {
            const value = localStorage.getItem(storageKey);

            if (value === null) {
                logger.debug("STORAGE", `get "${key}" -> null (fallback)`);
                return fallback;
            }

            const parsed = JSON.parse(value);
            logger.debug("STORAGE", `get "${key}" -> parsed`);
            return parsed;
        } catch (error) {
            logger.error("STORAGE", `Failed to read storage key "${key}"`, error);

            return fallback;
        }
    },


    async set(key, value) {
        const storageKey = this.createKey(key);

        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify(value)
            );

            logger.debug("STORAGE", `set "${key}"`);
            return true;
        } catch (error) {
            logger.error("STORAGE", `Failed to save storage key "${key}"`, error);

            return false;
        }
    },


    async remove(key) {
        const storageKey = this.createKey(key);

        try {
            localStorage.removeItem(storageKey);

            logger.debug("STORAGE", `remove "${key}"`);
            return true;
        } catch (error) {
            logger.error("STORAGE", `Failed to remove storage key "${key}"`, error);

            return false;
        }
    },


    async clear() {
        const prefix = STORAGE_PREFIX;

        try {
            const keys = [];

            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);

                if (key?.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            for (const key of keys) {
                localStorage.removeItem(key);
            }

            logger.log("STORAGE", `cleared ${keys.length} keys`);
            return true;
        } catch (error) {
            logger.error("STORAGE", "Failed to clear RtG-AI storage", error);

            return false;
        }
    },


    createKey(key) {
        return `${STORAGE_PREFIX}${key}`;
    }
};


export {
    storage
};