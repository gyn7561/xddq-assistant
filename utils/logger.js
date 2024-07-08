import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments) => path.resolve(__dirname, ...segments);

const logDir = resolvePath('../logs');
const loglevel = 'info';
// const loglevel = 'debug';

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logFileName = path.join(
    logDir,
    `${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.log`,
);

const customLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const customColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'cyan',
};

winston.addColors(customColors);

function createLogFormat(colorize = false) {
    const colorizer = winston.format.colorize();
    const timestamp = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' });
    const logFormat = winston.format.printf((info) => {
        const levelWithoutColor = info.level.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
        const space = ' '.repeat(6 - levelWithoutColor.length);
        return `${info.timestamp} ${info.level}${space} ${info.message}`;
    });

    return colorize
        ? winston.format.combine(colorizer, timestamp, logFormat)
        : winston.format.combine(timestamp, logFormat);
}

const logger = winston.createLogger({
    level: loglevel,
    levels: customLevels,
    format: createLogFormat(),
    transports: [
        new winston.transports.Console({
            format: createLogFormat(true),
        }),
        new winston.transports.Stream({
            stream: fs.createWriteStream(logFileName, { flags: 'a' }),
        }),
    ],
    exitOnError: false,
});

export default logger;