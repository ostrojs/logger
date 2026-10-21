class InvalidArgumentException extends Error {
    public error: string;
    public statusCode: number;

    /**
     * Create a new InvalidArgumentException instance.
     *
     * @param message - The exception error message.
     */
    constructor(message: string) {
        super();
        this.name = this.constructor.name;
        this.message = message;
        this.error = message;
        this.statusCode = 500;
        Error.captureStackTrace(this, this.constructor);
    }
}

export default InvalidArgumentException;