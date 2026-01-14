// src/utils/logger.ts
/**
 * 🚀 PERFORMANCE: Production-safe logger
 * 
 * All debug/info logs are stripped in production builds,
 * eliminating console.log overhead.
 */

const isDev = __DEV__;

export const logger = {
    /**
     * Debug logs - only in development
     * Use for verbose debugging info
     */
    debug: isDev ? console.log.bind(console) : () => { },

    /**
     * Info logs - only in development  
     * Use for general information
     */
    info: isDev ? console.info.bind(console) : () => { },

    /**
     * Warning logs - always logged
     * Use for recoverable errors
     */
    warn: console.warn.bind(console),

    /**
     * Error logs - always logged
     * Use for unexpected errors
     */
    error: console.error.bind(console),
};

/**
 * Helper to log performance metrics
 */
export function logPerformance(label: string, startTime: number) {
    if (isDev) {
        const duration = Date.now() - startTime;
        console.log(`⏱️ [Performance] ${label}: ${duration}ms`);
    }
}

/**
 * Helper to log with emoji prefixes
 */
export const e2eeLogger = {
    debug: (msg: string, ...args: any[]) => logger.debug('🔐 [E2EE]', msg, ...args),
    info: (msg: string, ...args: any[]) => logger.info('🔐 [E2EE]', msg, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn('🔐 [E2EE]', msg, ...args),
    error: (msg: string, ...args: any[]) => logger.error('🔐 [E2EE]', msg, ...args),
};

export const notifyLogger = {
    debug: (msg: string, ...args: any[]) => logger.debug('🔔 [Notify]', msg, ...args),
    info: (msg: string, ...args: any[]) => logger.info('🔔 [Notify]', msg, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn('🔔 [Notify]', msg, ...args),
    error: (msg: string, ...args: any[]) => logger.error('🔔 [Notify]', msg, ...args),
};
