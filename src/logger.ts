import mkdirp = require("mkdirp");

import winston = require('winston');
import WinstonDailyRotateFile = require('winston-daily-rotate-file');
import path = require('path');
import {Report} from "./report";

const logsFolder = './logs';

mkdirp(logsFolder, function (err) {
    if (err !== null)
        throw("Failed to create log folder");
});

const logger = winston.createLogger({
    transports: [
        new WinstonDailyRotateFile({
            level: 'info',
            filename: path.join(logsFolder, 'json-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.metadata(),
            )
        }),
        new WinstonDailyRotateFile({
            level: 'info',
            filename: path.join(logsFolder, 'simple-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(info => {
                    return `${info.timestamp} ${info.level}: ${info.message}}`
                })
            ),
        }),
        new winston.transports.Console({
            level: 'info',
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(info => {
                    return `${info.timestamp} ${info.level}: ${info.message}`
                })
            ),
        })
    ],
    exitOnError: true
});

// unhandled promise rejections: https://nodejs.org/api/process.html#process_event_unhandledrejection
// winston currently lacks implicit unhandled rejections handling 
// Handle Promise unhandledRejection's: https://github.com/winstonjs/winston/issues/921
process.on('unhandledRejection', async (reason, promise) => {
    await Report.sendFatalErrorReport('Unhandled Rejection: ' + reason)
        .catch(err =>  logger.error('Failed to send fatal mail report (unhandled rejection)' + JSON.stringify((err))));
    logger.error('Unhandled Rejection: ' + reason);
    process.exit(1);
});

// uncaught exception: https://nodejs.org/api/process.html#process_event_uncaughtexception
process.on('uncaughtException', async (err) => {
    await Report.sendFatalErrorReport('Uncaught exception' + err)
        .catch(err =>  logger.error('Failed to send fatal mail report (uncaught exception): ' + JSON.stringify((err))));
    logger.error('Uncaught exception' + err);
    //no need to exit process, it will exit anyway as long as 'exitOnError' is set to true in winston logger
});

export default logger;