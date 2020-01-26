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

    constructor(readonly system: string) {

    }

    log(level: LogLevel, message: string | messageBuilder) {
        if (Logger.logLevel >= level) {
            if (message instanceof Function) message = message();
            Logger.writeLog(`${LogLevel[level]}:${this.system}: ${message}`);
        }
    }

    readonly debug = (message: string | messageBuilder) => this.log(LogLevel.DEBUG, message); 
    readonly info = (message: string | messageBuilder) => this.log(LogLevel.INFO, message); 
    readonly display = (message: string | messageBuilder) => this.log(LogLevel.DISPLAY, message);
    readonly warning = (message: string | messageBuilder) => this.log(LogLevel.WARNING, message); 
    readonly error = (message: string | messageBuilder) => this.log(LogLevel.ERROR, message); 
}