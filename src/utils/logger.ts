export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARNING = 2,
    INFO = 3,
    DEBUG = 4,
}

export class Logger {
    static logLevel = LogLevel.INFO;

    constructor(readonly system: string) {

    }

    log(level: LogLevel, message: string) {
        if (Logger.logLevel >= level)
            console.log(`${LogLevel[level]}:${this.system}: ${message}`);
    }

    readonly debug = (message: string) => this.log(LogLevel.DEBUG, message); 
    readonly info = (message: string) => this.log(LogLevel.INFO, message); 
    readonly warning = (message: string) => this.log(LogLevel.WARNING, message); 
    readonly error = (message: string) => this.log(LogLevel.ERROR, message); 
}