import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation, FunctionAction, CommandStationError } from "./commandStation";
import { parseConnectionString } from "../../utils/parsers";
import { ensureCvNumber, ensureByte, ensureAddress, ensureSpeed, ensureFunction } from "./nmraUtils";
import * as WebSocket from "ws";
import * as messages from "../../common/messages";
import { timestamp } from "../../common/time";

const log = new Logger("WebSocketCommandStation");

let _nextMessageNumber = 1;
function createRequest<T>(type: messages.RequestType, data: T): messages.TransportMessage {
    return {
        tag: `client:${_nextMessageNumber++}`,
        requestTime: timestamp(),
        type: type,
        data: data
    }
}

export class WebSocketCommandStation extends CommandStationBase {
    static readonly deviceId = "WebSocket";
    readonly version: string = "1.0.1"
    readonly deviceId: string = WebSocketCommandStation.deviceId;

    readonly url: string = null;
    private _ws: WebSocket = null;

    // Current request details
    private _requestTag: string = null;
    private _requestResponseCallback: (response: messages.CommandResponse) => void = null;
    private _requestResolve: () => void = null;
    private _requestReject: (error: Error) => void = null;

    static async open(connectionString?: string): Promise<ICommandStation> {
        let cs = new WebSocketCommandStation(connectionString);
        await cs._connect();
        return cs
    }

    static createSocket(url: string) {
        // This function is to allow testing by replacing it with a stub
        return new WebSocket(url);
    }

    private constructor(connectionString: string) {
        super(log);
        const config = parseConnectionString(connectionString);
        if (!config.url) throw new CommandStationError('"url" not specified in connection string');
        this.url = config.url;
        this._setState(CommandStationState.INITIALISING);

        this._ws = WebSocketCommandStation.createSocket(this.url);
        this._ws.on("open", () => {
            this._onOpen();
        });
        this._ws.on("close", (_, reason) => {
            this._onClose(reason);
        });
        this._ws.on("error", (err) => {
            this._onError(err);
        });
        this._ws.on("message", (data) => {
            try {
                const message = JSON.parse(data as string);
                this._onMessage(message);
            }
            catch (err) {
                log.error(`Error handling WebSocket message: ${err.stack}`);
            }
        });
    }

    private async _connect() {
        await this._untilIdle();
    }

    private _onOpen() {
        this._setIdle();
    }

    private _onClose(reason: string) {
        if (this.state != CommandStationState.SHUTTING_DOWN) {
            this._onError(new CommandStationError(`WebSocket closed unexpectedly. Reason: ${reason}`));
        }
        else {
            this._setState(CommandStationState.NOT_CONNECTED);
            this._requestReject?.(new CommandStationError("Connection closed"));
        }
    }

    private _onError(err: Error) {
        this._setError(err);
        this._requestReject?.(err);
    }

    private _onMessage(message: messages.TransportMessage) {
        if (message.type !== messages.RequestType.CommandResponse) return;
        if (message.tag !== this._requestTag) return;

        this._onResponse(message.data);
    }

    private _onResponse(response: messages.CommandResponse) {
        if (response.lastMessage) {
            if (response.error) {
                this._requestReject(new CommandStationError(response.error));
            }
            else {
                this._requestResolve();
            }
        }
        else {
            this._requestResponseCallback?.(response);
        }
    }

    private _clearRequest() {
        this._requestTag = null;
        this._requestResponseCallback = null;
        this._requestResolve = null;
        this._requestReject = null;
        // We want to check this so that we don't accidentally clear an error or closed state
        if (this.state === CommandStationState.BUSY) this._setIdle();
    }

    private async _request(message: messages.TransportMessage, onResponse: (response: messages.CommandResponse) => void = null): Promise<void> {
        await this._requestIdleToBusy();
        return new Promise<void>((resolve, reject) => {
            this._requestTag = message.tag;
            this._requestResponseCallback = onResponse;
            this._requestResolve = () => {
                this._clearRequest();
                resolve();
            }
            this._requestReject = (err) => {
                this._clearRequest();
                reject(err);
            }
            this._ws.send(JSON.stringify(message));
        });
    }

    close(): Promise<void> {
        if (this.state === CommandStationState.NOT_CONNECTED) return Promise.resolve();
        if (this.state !== CommandStationState.SHUTTING_DOWN) {
            this._setState(CommandStationState.SHUTTING_DOWN);
            this._ws.close();
        }
        return this._untilState(CommandStationState.NOT_CONNECTED);
    }

    beginCommandBatch(): Promise<ICommandBatch> {
        return Promise.resolve(new WebSocketCommandBatch(async (requests) => {
            for (const request of requests) {
                await this._request(request);
            }
        }));
    }

    async readLocoCv(cv: number): Promise<number> {
        log.verbose(() => `readLocoCv - cv=${cv}`);
        ensureCvNumber(cv);

        let cvValue = -1;
        const request = createRequest<messages.LocoCvReadRequest>(messages.RequestType.LocoCvRead, {
            cvs: [cv]
        });
        await this._request(request, (response) => {
            const data = response.data as messages.CvValuePair;
            if (data.cv === cv) cvValue = data.value;
        });

        if (cvValue === -1) throw new CommandStationError("No CV data returned");
        return cvValue;
    }

    async writeLocoCv(cv: number, value: number): Promise<void> {
        log.verbose(() => `writeLocoCv - cv=${cv}, value=${value}`);
        ensureCvNumber(cv);
        ensureByte(value);

        const request = createRequest<messages.LocoCvWriteRequest>(messages.RequestType.LocoCvWrite, {
            cvs: [{
                cv: cv,
                value: value
            }]
        });

        await this._request(request);
    }
}

function ActionCommandStationToApi(action: FunctionAction) {
    switch (action) {
        case FunctionAction.TRIGGER: return messages.FunctionAction.Trigger;
        case FunctionAction.LATCH_ON: return messages.FunctionAction.LatchOn;
        case FunctionAction.LATCH_OFF: return messages.FunctionAction.LatchOff;
        default: throw new Error(`Invalid action ${action}`);
    }
};

export class WebSocketCommandBatch implements ICommandBatch {
    private _batch: messages.TransportMessage[] = [];

    constructor(private readonly _commit: (requests: messages.TransportMessage[])=>Promise<void>) {

    }

    private _ensureUncommitted() {
        if (!this._batch) throw new CommandStationError("Command batch already committed");
    }

    async commit()
    {
        this._ensureUncommitted();
        const batch = this._batch;
        this._batch = null;
        await this._commit(batch);
        log.verbose("Committed command batch");
    }
    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): void {
        log.verbose(() => `setLocomotiveSpeed - locoId=${locomotiveId}, speed=${speed}, reverse=${!!reverse}`);
        this._ensureUncommitted();
        ensureAddress(locomotiveId);
        ensureSpeed(speed);

        const request = createRequest<messages.LocoSpeedRequest>(messages.RequestType.LocoSpeed, {
            locoId: locomotiveId,
            speed: speed,
            reverse: reverse
        });
        this._batch.push(request);
    }

    setLocomotiveFunction(locomotiveId: number, func: number, action: FunctionAction): void {
        log.verbose(() => `setLocomotiveFunction - locoId=${locomotiveId}, function=${func}, action=${FunctionAction[action]}`);
        this._ensureUncommitted();
        ensureAddress(locomotiveId);
        ensureFunction(func);

        const request = createRequest<messages.LocoFunctionRequest>(messages.RequestType.LocoFunction, {
            locoId: locomotiveId,
            function: func,
            action: ActionCommandStationToApi(action)
        });
        this._batch.push(request);
    }

    writeRaw(data: Buffer | number[]): void {
        throw new CommandStationError("Raw writes are not unsupported");
    }
}
