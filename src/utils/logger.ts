export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARNING = 2,
    DISPLAY = 3,
    INFO = 4,
    DEBUG = 5,
}

type messageBuilder = () => string;
type logWriter = (message: string) => void;

function consoleLogger(message: string) {
    console.log(message);
}

function padZero(number: number, size?: number) {
    size = size || 2;
    return ("00" + number).substr(-size);
}

export class Logger {
    static logLevel = LogLevel.INFO;
    static writeLog: logWriter = consoleLogger;

    static set testMode(enabled: boolean) {
        if (enabled) {
            Logger.logLevel = LogLevel.DEBUG;
            Logger.writeLog = (m) => {};
        }
        else {
            Logger.logLevel = LogLevel.INFO;
            Logger.writeLog = consoleLogger;
        }
    }

    static timestamp(): string {
        const d = new Date()
        const year = d.getUTCFullYear();
        const month = padZero(d.getUTCMonth()+1);
        const date = padZero(d.getUTCDate());
        const hours = padZero(d.getUTCHours());
        const mins = padZero(d.getUTCMinutes());
        const seconds = padZero(d.getUTCSeconds());
        const ms = padZero(d.getUTCMilliseconds(), 3);
        return `${year}-${month}-${date}T${hours}:${mins}:${seconds}.${ms}Z`;
    }

    constructor(readonly system: string) {

    }

    log(level: LogLevel, message: string | messageBuilder) {
        if (Logger.logLevel >= level) {
            if (message instanceof Function) message = message();
            Logger.writeLog(`${Logger.timestamp()}:${LogLevel[level]}:${this.system}: ${message}`);
        }
    }

    debug (message: string | messageBuilder) { this.log(LogLevel.DEBUG, message); }
    info (message: string | messageBuilder) { this.log(LogLevel.INFO, message); }
    display (message: string | messageBuilder) { this.log(LogLevel.DISPLAY, message); }
    warning (message: string | messageBuilder) { this.log(LogLevel.WARNING, message); }
    error (message: string | messageBuilder) { this.log(LogLevel.ERROR, message); }
}