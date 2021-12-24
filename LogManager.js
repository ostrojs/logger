require('@ostro/support/helpers')
const Manager = require('@ostro/support/manager')
const LineFormatter = require('./LineFormatter')
const Logger = require('./Logger')
const InvalidArgumentException = require('./InvalidArgumentException')
const { Winston, transports, format } = require('./winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs')
const { Console } = require('console');

class LogManager extends Manager {

    $type = 'logging';

    stack($channels, $channel = null) {
        return new Logger(
            this.createStackDriver({
                channels: this.$drivers
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
        return this.$drivers[$name] || (this.$drivers[$name] = new Logger(this.resolve($name), this.configurationFor($name)))
    }

    createEmergencyLogger() {
        return new Logger(new Winston('Ostro', this.prepareHandlers([new StreamHandler(
            this.$container.storagePath() + '/logs/Ostro.log', this.level({
                'level': 'debug'
            })
        )])), this.$container['events']);
    }

    resolve($name) {
        let $config = this.configurationFor($name);
        if (!($config)) {
            throw new InvalidArgumentException("Log [{" + $name + "}] is not defined.");
        }
        return super.resolve($name, $config)
    }


    createCustomDriver($config) {
        let $via = $config['via']
        let $factory = is_callable($via) ? $via : this.$container.make($via);
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
            $handler.format = (this.$container.make($config['formatter'], $config['formatter_with'] || null));
        }

        return $handler;
    }

    formatter(config) {
        return new LineFormatter(config);
    }

    configurationFor(name) {
        return super.getConfig(`channels.${name}`);
    }

    report($exception) {
        this.driver().error($exception)
    }
}

module.exports = LogManager