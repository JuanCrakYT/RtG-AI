const STORAGE_PREFIX = "rtg-ai:";


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
                return fallback;
            }

            return JSON.parse(value);
        } catch (error) {
            console.error(
                `Failed to read storage key "${key}":`,
                error
            );

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

            return true;
        } catch (error) {
            console.error(
                `Failed to save storage key "${key}":`,
                error
            );

            return false;
        }
    },


    async remove(key) {
        const storageKey = this.createKey(key);

        try {
            localStorage.removeItem(storageKey);

            return true;
        } catch (error) {
            console.error(
                `Failed to remove storage key "${key}":`,
                error
            );

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

            return true;
        } catch (error) {
            console.error(
                "Failed to clear RtG-AI storage:",
                error
            );

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