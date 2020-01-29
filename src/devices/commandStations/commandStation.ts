import { EventEmitter } from "events";
import { Logger } from "../../utils/logger";

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

    close(): Promise<void>;
    beginCommandBatch(): Promise<ICommandBatch>;
}

export interface ICommandStationConstructable {
    readonly deviceId: string; 
    open(connectionString: string): Promise<ICommandStation>;
}

export abstract class CommandStationBase extends EventEmitter implements ICommandStation {
    abstract version: string;
    abstract deviceId: string;

    get state() {
        return this._state;
    }

    get isIdle() {
        return this._state == CommandStationState.IDLE;
    }

    get isBusy() {
        return this._state == CommandStationState.BUSY;
    }

    protected _log: Logger;

    private _state: CommandStationState = CommandStationState.UNINITIALISED;

    protected constructor(logger?: Logger) {
        super();
        this._log = logger || new Logger("CommandStation");
    }

    abstract close(): Promise<void>;
    abstract beginCommandBatch(): Promise<ICommandBatch>;

    protected _setState(state: CommandStationState) {
        const prevState = this._state;
        this._state = state;
        this._log.debug(() => `State changing from ${CommandStationState[prevState]} to ${CommandStationState[state]}`);
        this.emit("state", this._state, prevState);
    }

    protected _ensureState(state: CommandStationState) {
        if (this._state != state) throw new CommandStationError(`${this.deviceId} is in wrong state for requested operation, state=${CommandStationState[this._state]}, expectedState=${CommandStationState[state]}`);
    }

    protected _ensureIdle() {
        this._ensureState(CommandStationState.IDLE);
    }

    protected _setBusy() {
        this._setState(CommandStationState.BUSY);
    }

    protected _setIdle() {
        this._setState(CommandStationState.IDLE);
    }

}

export class CommandStationError extends Error {
    constructor(message: string) {
        super(message);
    }

    readonly name = this.constructor.name;
}