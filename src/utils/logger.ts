export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3
}

export class Logger {
    public static logLevel = LogLevel.INFO;

    public constructor(readonly system: string) {

    }

    log(level: LogLevel, message: string) {
        if (level >= Logger.logLevel)
            console.log(`${LogLevel[level]}:${this.system}: ${message}`);
    }

    readonly debug = (message: string) => this.log(LogLevel.DEBUG, message); 
    readonly info = (message: string) => this.log(LogLevel.INFO, message); 
    readonly warning = (message: string) => this.log(LogLevel.WARNING, message); 
    readonly error = (message: string) => this.log(LogLevel.ERROR, message); 
}