import '@ostro/support/helpers';
import Manager from '@ostro/support/manager';
import LineFormatter from './LineFormatter';
import Logger from './Logger';
import InvalidArgumentException from './InvalidArgumentException';
import { Winston, transports, format } from './winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';
import { Console } from 'console';
import { is_callable, collect } from '@ostro/support/function';

class LogManager extends Manager {
    /**
     * Default type identifier for logging manager.
     */
    public $type: string = 'logging';

    declare $drivers: Record<string, Logger>;
    declare $container: any;

    /**
     * Create a new stack log channel instance.
     *
     * @param channels - Array of channel names.
     * @param channel - Optional channel name.
     * @returns Logger instance configured with the stack driver.
     */
    public stack($channels: string[], $channel: string | null = null): Logger {
        return new Logger(
            this.createStackDriver({
                channels: $channels
            }),
        );
    }

    /**
     * Get a log channel instance.
     *
     * @param channel - Channel name.
     * @returns Logger instance for the channel.
     */
    public channel($channel: string | null = null): Logger {
        return this.driver($channel);
    }

    /**
     * Get a log driver instance.
     *
     * @param driver - Driver/channel name.
     * @returns Resolved Logger instance.
     */
    public driver($driver: string | null = null): Logger {
        return this.get($driver || this.getDefaultDriver());
    }

    /**
     * Attempt to get the log from the local cache.
     *
     * @param name - Channel name.
     * @returns Cached or newly created Logger instance.
     */
    get($name: string): Logger {
        return this.$drivers[$name] || (this.$drivers[$name] = new Logger(this.resolve($name), this.configurationFor($name)));
    }

    /**
     * Create an emergency log handler.
     *
     * @returns Emergency Logger instance.
     */
    public createEmergencyLogger(): Logger {
        const storagePath = typeof this.$container.storagePath === 'function'
            ? this.$container.storagePath()
            : path.resolve('storage');
        return new Logger(
            new Winston('Ostro', this.prepareHandlers([
                this.prepareHandler(
                    new transports.File({
                        filename: path.join(storagePath, 'logs', 'Ostro.log'),
                        level: 'debug'
                    })
                )
            ])),
            this.$container['events']
        );
    }

    /**
     * Resolve the given log instance by name.
     *
     * @param name - Channel name.
     * @returns Resolved driver instance.
     * @throws InvalidArgumentException When channel configuration is not found.
     */
    public resolve($name: string): unknown {
        let $config = this.configurationFor($name);
        if (!($config)) {
            throw new InvalidArgumentException("Log [" + $name + "] is not defined.");
        }
        return super.resolve($name, $config);
    }

    /**
     * Create a custom log driver instance.
     *
     * @param config - Driver configuration object.
     * @returns Driver instance returned by the custom factory.
     */
    public createCustomDriver($config: Record<string, any>): unknown {
        let $via = $config['via'];
        let $factory = is_callable($via) ? $via : this.$container.make($via);
        return $factory($config);
    }

    /**
     * Create an aggregate log driver instance.
     *
     * @param config - Stack driver configuration object.
     * @returns Winston instance aggregating multiple handlers.
     */
    public createStackDriver($config: Record<string, any>): Winston {
        let $handlers = collect($config['channels']).flatMap(($channel: string) => {
            let ch = this.channel($channel);
            return ch.getLogger().getHandler();
        }).all();
        if (!$config['ignore_exceptions']) {
            $handlers.handleExceptions = true;
        }
        return new Winston($config, $handlers);
    }

    /**
     * Create a syslog driver instance.
     *
     * @param config - Driver configuration object.
     * @returns Console instance streaming to log files.
     */
    public createSyslogDriver($config: Record<string, any>): Console {
        const output = fs.createWriteStream(path.resolve('storage/logs/application.log'));
        const errorOutput = fs.createWriteStream(path.resolve('storage/logs/application.log'));
        return new Console({
            stdout: output,
            stderr: errorOutput
        });
    }

    /**
     * Create an instance of the single file log driver.
     *
     * @param config - Driver configuration object.
     * @returns Winston instance for single file logging.
     */
    public createSingleDriver($config: Record<string, any>): Winston {
        return new Winston($config, [
            this.prepareHandler(
                new transports.File({
                    filename: $config['path'] || 'storage/logs/application.log'
                }), $config
            ),
        ]);
    }

    /**
     * Create an instance of the console log driver.
     *
     * @param config - Driver configuration object.
     * @returns Winston instance for console output.
     */
    public createConsoleDriver($config: Record<string, any>): Winston {
        return new Winston($config, [
            this.prepareHandler(new transports.Console({ colorize: true, format: format.colorize() } as any), $config)
        ]);
    }

    /**
     * Create an instance of the daily rotating file log driver.
     *
     * @param config - Driver configuration object.
     * @returns Winston instance for daily rotating file logging.
     */
    public createDailyDriver($config: Record<string, any>): Winston {
        return new Winston($config, [
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

    /**
     * Prepare the transport instance.
     *
     * @typeParam T - Transport type.
     * @param transport - Transport instance.
     * @returns Prepared transport instance.
     */
    public prepareTransport<T = unknown>(transport: T): T {
        return transport;
    }

    /**
     * Prepare the log handlers.
     *
     * @typeParam T - Handlers type.
     * @param handlers - Handlers instance or collection.
     * @returns Prepared handlers.
     */
    public prepareHandlers<T = unknown>($handlers: T): T {
        return $handlers;
    }

    /**
     * Prepare the handler instance by assigning formatter.
     *
     * @param handler - Winston transport handler.
     * @param config - Configuration options.
     * @returns Prepared transport handler.
     */
    public prepareHandler($handler: any, $config: Record<string, any> = {}): any {
        if (!($config['formatter'])) {
            $handler.format = this.formatter();
        } else if ($config['formatter'] !== 'default') {
            $handler.format = this.$container.make($config['formatter'], $config['formatter_with'] || null);
        }

        return $handler;
    }

    /**
     * Get line formatter instance.
     *
     * @param config - Formatter configuration options.
     * @returns LineFormatter instance.
     */
    public formatter(config: Record<string, unknown> = {}): LineFormatter {
        return new LineFormatter(config);
    }

    /**
     * Get the log connection configuration.
     *
     * @param name - Channel name.
     * @returns Channel configuration.
     */
    public configurationFor(name: string): Record<string, any> {
        return super.getConfig(`channels.${name}`);
    }

    /**
     * Report an exception to the default log driver.
     *
     * @param exception - Exception or error to report.
     */
    public report($exception: unknown): void {
        this.driver().error($exception);
    }
}

export default LogManager;