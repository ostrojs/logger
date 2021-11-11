const { format: { combine, splat, simple, timestamp, json, label, printf, prettyPrint, colorize } } = require('winston')

class Formatter {
    constructor(config = {}) {
        return this.combine(config)
    }
    messageFormat() {
        return printf(({ level, message, timestamp }) => {
            if (message instanceof Error) {
                message = message.stack
            } else if (typeof message == 'object') {
                message = JSON.stringify(message, undefined, 2)
            }
            return `[${timestamp}] [${level}] : ${message}\n`
        })
    }
    combine() {
        return combine(
            timestamp(),
            prettyPrint(),
            this.messageFormat(),
        )
    }
}
module.exports = Formatter