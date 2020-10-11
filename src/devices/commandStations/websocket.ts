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
    static readonly deviceId = "WebSocketCommandStation";
    readonly version: string = "1.0.0"
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
        await cs.connect();
        return cs
    }

    static createSocket(url: string) {
        return new WebSocket(url);
    }

    constructor(connectionString: string) {
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

    async connect() {
        await this._untilIdle();
    }

    private _onOpen() {
        this._setIdle();
    }

    private _onClose(reason: string) {
        if (this.state != CommandStationState.SHUTTING_DOWN) {
            this._setError(new CommandStationError(`WebSocket closed unexpectedly. Reason: ${reason}`));
        }
        else {
            this._setState(CommandStationState.NOT_CONNECTED);
        }
    }

    private _onMessage(message: messages.TransportMessage) {
        if (message.type !== messages.RequestType.CommandResponse) return;
        if (message.tag !== this._requestTag) return;

        this._onResponse(message.data);
    }

    private _onResponse(response: messages.CommandResponse) {
        const callback = this._requestResponseCallback;
        const resolve = this._requestResolve;
        const reject = this._requestReject;

        // We explicitly clear out the current request before triggering callbacks so that the
        // callback is able to immediately issue a new request if desired
        if (response.lastMessage) this._clearRequest();

        if (response.error) {
            reject(new CommandStationError(response.error));
        }
        else {
            callback && callback(response);
            if (response.lastMessage) resolve();
        }
    }

    private _clearRequest() {
        this._requestTag = null;
        this._requestResponseCallback = null;
        this._requestResolve = null;
        this._requestReject = null;
        this._setIdle();
    }

    private async _request(message: messages.TransportMessage, callback: (response: messages.CommandResponse) => void = null): Promise<void> {
        await this._requestIdleToBusy();
        this._requestTag = message.tag;
        return new Promise<void>((resolve, reject) => {
            this._requestResponseCallback = callback;
            this._requestResolve = resolve;
            this._requestReject = reject;
            this._ws.send(JSON.stringify(message));
        });
    }

    private _onError(err: Error) {
        this._setError(err);
        if (this._requestReject) this._requestReject(err);
    }

    close(): Promise<void> {
        this._setState(CommandStationState.SHUTTING_DOWN);
        this._ws.close();
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
            if (!response.lastMessage) {
                const data = response.data as messages.CvValuePair;
                if (data.cv === cv) cvValue = data.value;
            }
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