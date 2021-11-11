const { createLogger, transports, format } = require('winston')
const kLogger = Symbol('logger')
class Winston {
    constructor(config, handlers) {
        this[kLogger] = this.createLogger(handlers)
    }

    log(level, message, context) {
        this[kLogger].log(level, message, context);
    }
    createLogger(handlers) {
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
            transports: handlers
        })
    }
    getHandler() {
        return this[kLogger]
    }

}
module.exports = {
    Winston,
    transports,
    format
}