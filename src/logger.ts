import mkdirp = require("mkdirp");
import {TransformableInfo} from "logform";

import winston = require('winston');
import WinstonDailyRotateFile = require('winston-daily-rotate-file');
import path = require('path');

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
            )
        }),
        new WinstonDailyRotateFile({
            level: 'info',
            filename: path.join(logsFolder, 'simple-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            handleExceptions: true,
            format: winston.format.simple()
        }),
        new winston.transports.Console({
            level: 'info',
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss' }),
                // winston.format.json(),
                winston.format.printf((info: TransformableInfo) => {
                    return `${info.timestamp} ${info.level}: ${info.message}`;
                })
            )
        })
        // new winston.transports.Console( {
        //     level: 'debug',
        //     handleExceptions: true,
        //     format: winston.format.combine(
        //         winston.format.timestamp(),
        //         winston.format.prettyPrint()
        //     )
        // })
    ]
});

export default logger;