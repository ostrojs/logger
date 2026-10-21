import path from 'path';
import fs from 'fs';
import os from 'os';
import { format } from 'winston';

import '@ostro/support/helpers';

import InvalidArgumentException from '../src/InvalidArgumentException';
import LineFormatter from '../src/LineFormatter';
import Logger from '../src/Logger';
import { Winston, transports } from '../src/winston';
import LogManager from '../src/LogManager';
import LogServiceProvider from '../src/logServiceProvider';

describe('InvalidArgumentException', () => {
    test('creates an instance with message and statusCode', () => {
        const err = new InvalidArgumentException('Invalid arg provided');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('InvalidArgumentException');
        expect(err.message).toBe('Invalid arg provided');
        expect(err.error).toBe('Invalid arg provided');
        expect(err.statusCode).toBe(500);
        expect(err.stack).toBeDefined();
    });
});

describe('LineFormatter', () => {
    test('formats string, object, and Error messages', () => {
        const formatter = new LineFormatter();
        expect(formatter).toBeDefined();

        const messageFormatFn = LineFormatter.prototype.messageFormat.call({} as any);
        expect(typeof messageFormatFn.transform).toBe('function');

        // String message
        const infoString: Record<string | symbol, any> = { level: 'info', message: 'User logged in', timestamp: '2026-09-06 00:00:00' };
        messageFormatFn.transform(infoString as any);
        const symbolFormat = Object.getOwnPropertySymbols(infoString).find(s => s.toString().includes('message'))!;
        const formattedStr = infoString[symbolFormat];
        expect(formattedStr).toBe('[2026-09-06 00:00:00] [info] : User logged in\n');

        // Object message
        const infoObj: Record<string | symbol, any> = { level: 'debug', message: { id: 1, active: true }, timestamp: '2026-09-06 00:00:00' };
        messageFormatFn.transform(infoObj as any);
        const formattedObj = infoObj[symbolFormat];
        expect(formattedObj).toContain('{\n  "id": 1,\n  "active": true\n}');

        // Error message
        const testErr = new Error('Database connection failed');
        const infoErr: Record<string | symbol, any> = { level: 'error', message: testErr, timestamp: '2026-09-06 00:00:00' };
        messageFormatFn.transform(infoErr as any);
        const formattedErr = infoErr[symbolFormat];
        expect(formattedErr).toContain('Error: Database connection failed');
    });

    test('constructor default config parameter', () => {
        const f1 = new LineFormatter();
        const f2 = new LineFormatter({ custom: true });
        expect(f1).toBeDefined();
        expect(f2).toBeDefined();
    });
});

describe('Winston Wrapper', () => {
    test('instantiates with custom transports and logs message', () => {
        const customTransport = new transports.Console({
            silent: true
        });
        const winstonInstance = new Winston({}, [customTransport]);

        expect(winstonInstance.getHandler()).toBeDefined();
        winstonInstance.log('info', 'test winston message', { key: 'val' });
    });
});

describe('Logger', () => {
    test('delegates all logging levels and helper methods', () => {
        const mockUnderlyingLogger = {
            log: jest.fn()
        };
        const logger = new Logger(mockUnderlyingLogger, { channel: 'single' });

        logger.emergency('emerg msg', { a: 1 });
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('emerg', 'emerg msg', { a: 1 });

        logger.emergency('emerg default msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('emerg', 'emerg default msg', []);

        logger.alert('alert msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('alert', 'alert msg', []);

        logger.critical('crit msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('crit', 'crit msg', []);

        logger.error('error msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('error', 'error msg', []);

        logger.warning('warning msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('warning', 'warning msg', []);

        logger.notice('notice msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('notice', 'notice msg', []);

        logger.info('info msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('info', 'info msg', []);

        logger.debug('debug msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('debug', 'debug msg', []);

        logger.log('customLevel', 'custom msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('log', 'custom msg', []);

        logger.write('info', 'write msg');
        expect(mockUnderlyingLogger.log).toHaveBeenCalledWith('write', 'write msg', []);

        expect(logger.getLogger()).toBe(mockUnderlyingLogger);
    });
});

describe('LogServiceProvider', () => {
    test('registers logger singleton in application container', () => {
        const singletons: Record<string, any> = {};
        const mockApp = {
            singleton: jest.fn((name: string, factory: (app: any) => any) => {
                singletons[name] = factory(mockApp);
            }),
            make: jest.fn().mockReturnValue({})
        };

        const provider = new LogServiceProvider(mockApp);
        provider.register();

        expect(mockApp.singleton).toHaveBeenCalledWith('logger', expect.any(Function));
        expect(singletons['logger']).toBeInstanceOf(LogManager);
    });
});
