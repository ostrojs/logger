import { format } from 'winston';
import type { Logform } from 'winston';

const { combine, timestamp, prettyPrint, printf } = format;

class Formatter {
    /**
     * Create a new Formatter instance.
     *
     * @param config - Configuration options.
     */
    constructor(config: Record<string, unknown> = {}) {
        return this.combine(config) as unknown as Formatter;
    }

    /**
     * Define the custom printf message formatting.
     *
     * @returns Formatted logform Format instance.
     */
    public messageFormat(): Logform.Format {
        return printf(({ level, message, timestamp }: { level?: unknown; message?: unknown; timestamp?: unknown }) => {
            if (message instanceof Error) {
                message = message.stack;
            } else if (typeof message === 'object') {
                message = JSON.stringify(message, undefined, 2);
            }
            return `[${timestamp}] [${level}] : ${message}\n`;
        });
    }

    /**
     * Combine timestamp, prettyPrint, and messageFormat formats.
     *
     * @param config - Configuration options.
     * @returns Combined Logform Format instance.
     */
    public combine(config?: Record<string, unknown>): Logform.Format {
        return combine(
            timestamp(),
            prettyPrint(),
            this.messageFormat(),
        );
    }
}

export default Formatter;