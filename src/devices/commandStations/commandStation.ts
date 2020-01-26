export enum CommandStationState {
    UNINITIALISED = 0,
    INITIALISING,
    IDLE,
    BUSY,
    ERROR,
    SHUTTING_DOWN
}

export interface ICommandBatch {
    commit(): Promise<void>;
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean): void;
}

export interface ICommandStation extends NodeJS.EventEmitter {
    readonly version: string;
    readonly deviceId: string;
    readonly state: CommandStationState;

    init(): Promise<void>;
    close(): Promise<void>;
    beginCommandBatch(): Promise<ICommandBatch>;
}

export interface ICommandStationConstructable {
    readonly deviceId: string; 
    new (connectionString: string): ICommandStation;
}

export class CommandStationError extends Error {
    constructor(message: string) {
        super(message);
    }

    readonly name = this.constructor.name;
}