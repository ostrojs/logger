require('@ostro/support/helpers')
const LineFormatter = require('./LineFormatter')
const Logger = require('./Logger')
const InvalidArgumentException = require('./InvalidArgumentException')
require('@ostro/support/helpers')
const { Winston, transports, format } = require('./winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { Macroable } = require('@ostro/support/macro')
const fs = require('fs')
const { Console } = require('console');
const kApp = Symbol('app')
const kChannels = Symbol('channels')
const kCustomCreators = Symbol('customCreators')
class LogManager extends Macroable {

    constructor($app) {
        super()
        Object.defineProperties(this, {
            [kApp]: {
                value: $app,
            },
            [kChannels]: {
                value: Object.create(null),
                writable: true,
            },
            [kCustomCreators]: {
                value: Object.create(null),
                writable: true,
            }
        })
    }

    stack($channels, $channel = null) {
        return new Logger(
            this.createStackDriver({
                channels: this[kChannels]
            }),
        );
    }

    channel($channel = null) {
        return this.driver($channel);
    }

    driver($driver = null) {
        return this.get($driver || this.getDefaultDriver());
    }

    get($name) {
        return this[kChannels][$name] || (this[kChannels][$name] = new Logger(this.resolve($name), this.configurationFor($name)))

    }

    createEmergencyLogger() {
        return new Logger(new Winston('Ostro', this.prepareHandlers([new StreamHandler(
            this[kApp].storagePath() + '/logs/Ostro.log', this.level({
                'level': 'debug'
            })
        )])), this[kApp]['events']);
    }

    resolve($name) {
        let $config = this.configurationFor($name);
        if (!($config)) {
            throw new InvalidArgumentException("Log [{" + $name + "}] is not defined.");
        }
        if ((this[kCustomCreators][$config['driver']])) {
            return this.callCustomCreator($config);
        }
        let $driverMethod = 'create' + ($config['driver'].ucfirst()) + 'Driver';
        if (this[$driverMethod]) {
            return this[$driverMethod]($config);
        }
        throw new InvalidArgumentException(`Driver [{${$config['driver']}}] is not supported.`);
    }

    callCustomCreator($config) {
        return this[kCustomCreators][$config['driver']](this[kApp], $config);
    }

    createCustomDriver($config) {
        $factory = is_callable($via = $config['via']) ? $via : this[kApp].make($via);
        return $factory($config);
    }

    createStackDriver($config) {
        let $handlers = collect($config['channels']).flatMap(($channel) => {
            let ch = this.channel($channel)
            return ch.getLogger().getHandler()
        }).all();
        if (!$config['ignore_exceptions']) {
            $handlers.handleExceptions = true;
        }
        return new Winston(($config), $handlers);
    }

    createSyslogDriver($config) {
        const output = fs.createWriteStream(path.resolve('storage/logs/application.log'));
        const errorOutput = fs.createWriteStream(path.resolve('storage/logs/application.log'));
        return new Console({
            stdout: output,
            stderr: errorOutput
        });
    }

    createSingleDriver($config) {
        return new Winston(($config), [
            this.prepareHandler(
                new transports.File({
                    filename: $config['path'] || 'storage/logs/application.log'
                }), $config
            ),
        ]);
    }

    createConsoleDriver($config) {
        return new Winston(($config), [
            this.prepareHandler(new transports.Console({ colorize: true, format: format.colorize() }))
        ]);
    }

    createDailyDriver($config) {
        return new Winston(($config), [
            this.prepareHandler(new DailyRotateFile({
                filename: $config['path'] || 'storage/logs/application.log',
                datePattern: $config['date_pattern'] || 'YYYY-MM-DD',
                zippedArchive: false,
                level: $config['level'] || 'info',
                maxSize: $config['size'] || '10m',
                maxFiles: $config['14'] || '14d',
            }), $config),
        ]);
    }

    prepareTransport(transport) {
        return transport
    }

    prepareHandlers($handlers) {
        return $handlers;
    }

    prepareHandler($handler, $config = {}) {
        if (!($config['formatter'])) {
            $handler.format = (this.formatter());
        } else if ($config['formatter'] !== 'default') {
            $handler.format = (this[kApp].make($config['formatter'], $config['formatter_with'] || null));
        }

        return $handler;
    }

    formatter(config) {
        return new LineFormatter(config);
    }

    configurationFor($name) {
        return this[kApp]['config']['logging']['channels'][$name];
    }

    getDefaultDriver() {
        return this[kApp]['config']['logging']['default'];
    }

    setDefaultDriver($name) {
        this[kApp]['config']['logging']['default'] = $name;
    }

    extend($driver, $callback) {
        this[kCustomCreators][$driver] = $callback.bind(this);
        return this;
    }

    report($exception) {
        this.driver().error($exception)
    }
    getConfig($name) {
        this[kApp]['config']['logging'][$name]
    }

    __call(target, method, args) {
        return target.driver()[method](...args)
    }
}

module.exports = LogManager