export interface ICommandStation extends NodeJS.EventEmitter {
    readonly version: string;
    readonly deviceId: string;

    init(): Promise<void>;
    close(): Promise<void>;
    beginCommandBatch(): Promise<void>;
    commitCommandBatch(): Promise<void>;
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean): Promise<void>;
}

export interface ICommandStationConstructable {
    readonly deviceId: string; 
    new (connectionString: string): ICommandStation;
}

export class CommandStationError extends Error {
    constructor(message: string) {
        super(message);
    }

    get name():string {
        return this.constructor.name;
    }
}