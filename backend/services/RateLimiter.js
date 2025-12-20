/**
 * In-Memory Rate Limiter Service
 * Designed to be a singleton.
 * Can be swapped for Redis later.
 */

class RateLimiter {
    constructor() {
        this.windows = new Map(); // key: "userId:action" -> { count, startTime }
        this.usageHistory = new Map(); // key: "userId:action" -> [strings] (for repetition check)

        // Garbage Collection: Clean up every 10 mins
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    /**
     * Check Request Limit (Sliding Window / Fixed Window hybrid)
     * @param {string} key - Unique identifier (e.g., userId + IP)
     * @param {string} action - Action name (e.g., "send_message")
     * @param {number} limit - Max requests
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} allowed
     */
    checkLimit(key, action, limit, windowMs) {
        const uniqueKey = `${key}:${action}`;
        const now = Date.now();

        let record = this.windows.get(uniqueKey);

        if (!record || (now - record.startTime > windowMs)) {
            // New window
            this.windows.set(uniqueKey, { count: 1, startTime: now });
            return true;
        }

        if (record.count >= limit) {
            return false; // Limit exceeded
        }

        // Increment
        record.count++;
        return true;
    }

    /**
     * Check Repetition (Spam Detection)
     * @param {string} key 
     * @param {string} content 
     * @param {number} maxRepeats 
     */
    checkRepetition(key, content, maxRepeats = 3) {
        const uniqueKey = `${key}:history`;
        let history = this.usageHistory.get(uniqueKey) || [];

        // Add new content
        history.push(content);
        if (history.length > maxRepeats) {
            history.shift(); // Keep only last N items
        }
        this.usageHistory.set(uniqueKey, history);

        // Check if all items in history are identical
        if (history.length === maxRepeats) {
            const allSame = history.every(msg => msg === content);
            if (allSame) return false; // Spam detected
        }

        return true;
    }

    cleanup() {
        const now = Date.now();
        // Simple GC logic if we had thousands of users
        // For MVP, map size is manageable.
        if (this.windows.size > 50000) this.windows.clear();
        if (this.usageHistory.size > 50000) this.usageHistory.clear();
    }
}

module.exports = new RateLimiter();
