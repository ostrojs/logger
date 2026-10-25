import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { format } from 'winston';

import InvalidArgumentException from '../src/InvalidArgumentException';
import LineFormatter from '../src/LineFormatter';
import Logger from '../src/Logger';
import { Winston, transports } from '../src/winston';
import LogManager from '../src/LogManager';

describe('LogManager', () => {
    let tmpDir: string;

    beforeAll(() => {
        tmpDir = path.join(os.tmpdir(), `ostro-logger-test-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'logs'), { recursive: true });
    });

    afterAll(() => {
        // Keep directory until process exit to avoid stream close race conditions
    });

    function createMockContainer(configData: Record<string, unknown> = {}): Record<string, unknown> & { make: jest.Mock; storagePath: jest.Mock } {
        return {
            make: jest.fn((key: string | ((...args: unknown[]) => unknown), args?: unknown) => {
                if (key === 'config') return configData;
                if (typeof key === 'function') return key(args);
                return null;
            }),
            storagePath: jest.fn(() => tmpDir),
            events: {}
        };
    }

    test('throws InvalidArgumentException if channel is not defined in config', () => {
        const container = createMockContainer({
            logging: {
                default: 'non_existent',
                channels: {}
            }
        });
        const manager = new LogManager(container);
        expect(() => manager.driver('non_existent')).toThrow(InvalidArgumentException);
        expect(() => manager.driver('non_existent')).toThrow('Log [non_existent] is not defined.');
    });

    test('creates single driver and logs message', () => {
        const logPath = path.join(tmpDir, 'single.log');
        const container = createMockContainer({
            logging: {
                default: 'single',
                channels: {
                    single: {
                        driver: 'single',
                        path: logPath
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const logger = manager.driver();
        expect(logger).toBeInstanceOf(Logger);
        // Second call should return cached driver from $drivers
        expect(manager.driver()).toBe(logger);

        logger.info('Test single message');
        // Test channel() alias
        expect(manager.channel('single')).toBe(logger);
    });

    test('creates single driver with default path fallback', () => {
        const container = createMockContainer({
            logging: {
                channels: {
                    single_default: {
                        driver: 'single'
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const logger = manager.driver('single_default');
        expect(logger).toBeInstanceOf(Logger);
    });

    test('creates daily driver with custom and default options', () => {
        const logPath = path.join(tmpDir, 'daily.log');
        const container = createMockContainer({
            logging: {
                channels: {
                    daily_custom: {
                        driver: 'daily',
                        path: logPath,
                        date_pattern: 'YYYY-MM-DD-HH',
                        level: 'debug',
                        size: '5m',
                        '14': '7d'
                    },
                    daily_default: {
                        driver: 'daily'
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const dailyCustom = manager.driver('daily_custom');
        expect(dailyCustom).toBeInstanceOf(Logger);

        const dailyDefault = manager.driver('daily_default');
        expect(dailyDefault).toBeInstanceOf(Logger);
    });

    test('creates console driver and logs', () => {
        const container = createMockContainer({
            logging: {
                channels: {
                    console: {
                        driver: 'console'
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const consoleLogger = manager.driver('console');
        expect(consoleLogger).toBeInstanceOf(Logger);
    });

    test('creates custom driver via function or container', () => {
        const customFactory = jest.fn((config: any) => {
            return new Winston(config, [new transports.Console({ silent: true })]);
        });

        const container = createMockContainer({
            logging: {
                channels: {
                    custom_callable: {
                        driver: 'custom',
                        via: customFactory
                    },
                    custom_container: {
                        driver: 'custom',
                        via: 'customServiceFactory'
                    }
                }
            }
        });
        let customLoggingConfig: Record<string, unknown> = {
            logging: {
                channels: {
                    custom_callable: {
                        driver: 'custom',
                        via: customFactory
                    },
                    custom_container: {
                        driver: 'custom',
                        via: 'customServiceFactory'
                    }
                }
            }
        };
        container.make.mockImplementation((key: string) => {
            if (key === 'config') return customLoggingConfig;
            if (key === 'customServiceFactory') return customFactory;
            return null;
        });

        const manager = new LogManager(container);
        const c1 = manager.driver('custom_callable');
        expect(c1).toBeInstanceOf(Logger);
        expect(customFactory).toHaveBeenCalled();

        const c2 = manager.driver('custom_container');
        expect(c2).toBeInstanceOf(Logger);
    });

    test('creates stack driver aggregating multiple channels', () => {
        const container = createMockContainer({
            logging: {
                channels: {
                    c1: { driver: 'console' },
                    c2: { driver: 'console' },
                    my_stack: {
                        driver: 'stack',
                        channels: ['c1', 'c2'],
                        ignore_exceptions: false
                    },
                    ignore_stack: {
                        driver: 'stack',
                        channels: ['c1'],
                        ignore_exceptions: true
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const stackLogger = manager.driver('my_stack');
        expect(stackLogger).toBeInstanceOf(Logger);

        const ignoreStack = manager.driver('ignore_stack');
        expect(ignoreStack).toBeInstanceOf(Logger);

        // Test stack() direct helper
        const adhocStack = manager.stack(['c1', 'c2']);
        expect(adhocStack).toBeInstanceOf(Logger);
    });

    test('creates syslog driver with stdout and stderr streams', () => {
        const container = createMockContainer({
            logging: {
                channels: {
                    syslog: {
                        driver: 'syslog'
                    }
                }
            }
        });
        const manager = new LogManager(container);
        const syslogLogger = manager.driver('syslog');
        expect(syslogLogger).toBeInstanceOf(Logger);
    });

    test('creates emergency logger', () => {
        const container = createMockContainer({
            logging: { channels: {} }
        });
        const manager = new LogManager(container);
        const emergencyLogger = manager.createEmergencyLogger();
        expect(emergencyLogger).toBeInstanceOf(Logger);

        // Also test container without storagePath method
        const containerNoStorage = {
            make: jest.fn().mockReturnValue({ logging: { channels: {} } }),
            events: {}
        };
        const managerNoStorage = new LogManager(containerNoStorage);
        const emergencyLogger2 = managerNoStorage.createEmergencyLogger();
        expect(emergencyLogger2).toBeInstanceOf(Logger);
    });

    test('prepareHandler with custom formatter and default formatter', () => {
        const customFormatterInstance = format.simple();
        const container = createMockContainer({
            logging: {
                channels: {
                    custom_formatter: {
                        driver: 'console',
                        formatter: 'myCustomFormatter',
                        formatter_with: { format: 'raw' }
                    },
                    default_formatter: {
                        driver: 'console',
                        formatter: 'default'
                    }
                }
            }
        });
        let formatterConfig: Record<string, unknown> = {
            logging: {
                channels: {
                    custom_formatter: {
                        driver: 'console',
                        formatter: 'myCustomFormatter',
                        formatter_with: { format: 'raw' }
                    },
                    default_formatter: {
                        driver: 'console',
                        formatter: 'default'
                    }
                }
            }
        };
        container.make.mockImplementation((key: string, _args?: unknown) => {
            if (key === 'config') return formatterConfig;
            if (key === 'myCustomFormatter') return customFormatterInstance;
            return null;
        });

        const manager = new LogManager(container);
        // Test channel() with default null parameter
        manager.setDefaultDriver('custom_formatter');
        expect(manager.channel()).toBeInstanceOf(Logger);

        const customF = manager.driver('custom_formatter');
        expect(customF).toBeInstanceOf(Logger);

        // Test formatter without formatter_with
        const managerWithDefaultWith = new LogManager({
            make: (key: any) => (key === 'config' ? {
                logging: {
                    channels: {
                        formatter_no_with: {
                            driver: 'console',
                            formatter: 'myCustomFormatter'
                        }
                    }
                }
            } : customFormatterInstance)
        });
        const noWithLogger = managerWithDefaultWith.driver('formatter_no_with');
        expect(noWithLogger).toBeInstanceOf(Logger);

        const defaultF = manager.driver('default_formatter');
        expect(defaultF).toBeInstanceOf(Logger);
    });

    test('report() delegates error to default driver', () => {
        const container = createMockContainer({
            logging: {
                default: 'console',
                channels: {
                    console: { driver: 'console' }
                }
            }
        });
        const manager = new LogManager(container);
        const defaultDriver = manager.driver();
        const errorSpy = jest.spyOn(defaultDriver, 'error').mockImplementation(() => {});

        const err = new Error('Test report error');
        manager.report(err);
        expect(errorSpy).toHaveBeenCalledWith(err);
    });

    test('prepareTransport returns transport directly', () => {
        const manager = new LogManager(createMockContainer());
        const t = { id: 123 };
        expect(manager.prepareTransport(t)).toBe(t);
    });
});
