import { EventEmitter } from "events";
import { Logger } from "../../utils/logger";

export enum CommandStationState {
    NOT_CONNECTED = -1,
    UNINITIALISED = 0,
    INITIALISING,
    IDLE,
    BUSY,
    ERROR,
    SHUTTING_DOWN
}

export enum FunctionAction {
    TRIGGER,
    LATCH_ON,
    LATCH_OFF
}

export interface ICommandBatch {
    commit(): Promise<void>;
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean): void;
    setLocomotiveFunction(locomotiveId: number, func: number, action: FunctionAction): void;
    writeRaw(data: Buffer | number[]): void;
}

export interface ICommandStation extends NodeJS.EventEmitter {
    readonly version: string;
    readonly deviceId: string;
    readonly state: CommandStationState;

    close(): Promise<void>;
    beginCommandBatch(): Promise<ICommandBatch>;
    writeRaw(data: Buffer | number[]): Promise<void>;
    readLocoCv(cv: number): Promise<number>;
    writeLocoCv(cv: number, value: number): Promise<void>;
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
    private _error: Error = null;

    protected constructor(logger?: Logger) {
        super();
        this._log = logger || new Logger("CommandStation");
    }

    abstract close(): Promise<void>;
    abstract beginCommandBatch(): Promise<ICommandBatch>;

    writeRaw(data: Buffer | number[]): Promise<void> {
        return Promise.reject(new CommandStationError("Raw writes are not unsupported"));
    }

    readLocoCv(cv: number): Promise<number> {
        return Promise.reject(new Error("CV reading is not supported"));
    }

    writeLocoCv(cv: number, value: number): Promise<void> {
        return Promise.reject(new Error("CV writing is not supported"));
    }

    protected _setState(state: CommandStationState) {
        if (state === this._state) return;
        const prevState = this._state;
        this._state = state;
        this._log.debug(() => `State changing from ${CommandStationState[prevState]} to ${CommandStationState[state]}`);
        this.emit("state", this._state, prevState);
    }

    protected _setError(error: Error) {
        this._error = error;
        this._setState(CommandStationState.ERROR);
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

    // Waits until the command station reaches the requested state.
    // Will reject the promise if the command station transitions to the ERROR state while waiting.
    // This is to avoid batch commits waiting on command stations that have failed and may never
    // recover.
    protected _untilState(state: CommandStationState): Promise<void> {
        if (this.state === state) return Promise.resolve();
        return new Promise((resolve, reject) => {
            if (this.state === CommandStationState.ERROR) {
                reject(this._error ?? new CommandStationError("Command station is in ERROR state"));
                return; 
            }
            else if (this.state === CommandStationState.NOT_CONNECTED && state !== CommandStationState.NOT_CONNECTED) {
                reject(new CommandStationError("Connection closed"));
                return;
            }

            const listener = (newState: CommandStationState) => {
                if (newState === state) {
                    this.off("state", listener);
                    resolve();
                }
                else if (newState === CommandStationState.ERROR) {
                    this.off("state", listener);
                    reject(this._error ?? new CommandStationError("Command station is in ERROR state"));
                }
                else if (newState === CommandStationState.NOT_CONNECTED && state !== CommandStationState.NOT_CONNECTED) {
                    this.off("state", listener);
                    reject(new CommandStationError("Connection closed"));
                }
            };
            this.on("state", listener);
        });
    }

    protected async _requestStateTransition(from: CommandStationState, to: CommandStationState) {
        while (this.state !== from) {
            await this._untilState(from);
        }
        this._setState(to);
    }

    protected async _requestIdleToBusy(): Promise<void> {
        return this._requestStateTransition(
            CommandStationState.IDLE,
            CommandStationState.BUSY
        );
    }

    protected _untilIdle(): Promise<void> {
        return this._untilState(CommandStationState.IDLE);
    }
}

export class CommandStationError extends Error {
    constructor(message: string) {
        super(message);
    }

    readonly name = this.constructor.name;
}