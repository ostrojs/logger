const kLogger = Symbol('logger')
const kConfig = Symbol('config')
class Logger {
    constructor($logger, $config) {
        this[kLogger] = $logger
    }

    emergency($message, $context = []) {
        this.writeLog('emerg', $message, $context);
    }

    alert($message, $context = []) {
        this.writeLog('alert', $message, $context);
    }

    critical($message, $context = []) {
        this.writeLog('crit', $message, $context);
    }

    error($message, $context = []) {
        this.writeLog('error', $message, $context);
    }

    warning($message, $context = []) {
        this.writeLog('warning', $message, $context);
    }

    notice($message, $context = []) {
        this.writeLog('notice', $message, $context);
    }

    info($message, $context = []) {
        this.writeLog('info', $message, $context);
    }

    debug($message, $context = []) {
        this.writeLog('debug', $message, $context);
    }

    log($level, $message, $context = []) {
        this.writeLog('log', $message, $context);
    }

    write($level, $message, $context = []) {
        this.writeLog('write', $message, $context);
    }

    writeLog($level, $message, $context) {
        this[kLogger].log($level, $message, $context);
    }

    getLogger() {
        return this[kLogger];
    }

}

module.exports = Logger