import { createLogger, transports, format } from 'winston';
import type { Logger as WinstonLogger } from 'winston';

const kLogger: unique symbol = Symbol('logger');

class Winston {
    [kLogger]: WinstonLogger;

    /**
     * Create a new Winston instance.
     *
     * @param config - Driver configuration or channel name.
     * @param handlers - Winston transport handlers.
     */
    constructor(config: Record<string, unknown> | string, handlers: unknown) {
        this[kLogger] = this.createLogger(handlers);
    }

    /**
     * Log a message with the specified level and context.
     *
     * @param level - Log severity level.
     * @param message - Message to log.
     * @param context - Additional contextual metadata.
     */
    public log(level: string, message: unknown, context?: unknown): void {
        this[kLogger].log(level, message as any, context);
    }

    /**
     * Create an underlying Winston logger instance with custom log levels.
     *
     * @param handlers - Transport handlers.
     * @returns Winston Logger instance.
     */
    public createLogger(handlers: unknown): WinstonLogger {
        return createLogger({
            levels: {
                emerg: 0,
                alert: 1,
                crit: 2,
                error: 3,
                warning: 4,
                notice: 5,
                info: 6,
                debug: 7,
                warn: 8,
                http: 9,
                verbose: 10,
                silly: 11
            },
            transports: handlers as any
        });
    }

    /**
     * Retrieve the underlying Winston logger handler.
     *
     * @returns The underlying Winston logger instance.
     */
    public getHandler(): WinstonLogger {
        return this[kLogger];
    }
}

export {
    Winston,
    transports,
    format
};