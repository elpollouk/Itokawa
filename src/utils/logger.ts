import { timestamp } from "../common/time";

export enum LogLevel {
    NONE = 0,
    ERROR,      // Application errors
    WARNING,    // Application warnings
    DISPLAY,    // Messages the user should see but don't indicate errors or warnings
    INFO,       // User interactions or external events
    VERBOSE,    // Periodic automatic events
    DEBUG,      // Everything including packet level logs
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
            Logger.writeLog(`${timestamp()}:${LogLevel[level]}:${this.system}: ${message}`);
        }
    }

    debug (message: string | messageBuilder) { this.log(LogLevel.DEBUG, message); }
    verbose(message: string | messageBuilder) { this.log(LogLevel.VERBOSE, message); }
    info (message: string | messageBuilder) { this.log(LogLevel.INFO, message); }
    display (message: string | messageBuilder) { this.log(LogLevel.DISPLAY, message); }
    warning (message: string | messageBuilder) { this.log(LogLevel.WARNING, message); }
    error (message: string | messageBuilder) { this.log(LogLevel.ERROR, message); }
}