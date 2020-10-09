import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation, FunctionAction, CommandStationError } from "./commandStation";
import { parseConnectionString } from "../../utils/parsers";
import { ensureCvNumber, ensureByte } from "./nmraUtils";
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
        if (!this._requestResponseCallback) return;

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
            callback(response);
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

    private async _request(message: messages.TransportMessage, callback: (response: messages.CommandResponse) => void): Promise<void> {
        this._untilIdle();
        this._setBusy();
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
        throw new Error("Method not implemented.");
    }

    async readLocoCv(cv: number): Promise<number> {
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

    writeLocoCv(cv: number, value: number): Promise<void> {
        return Promise.reject(new Error("CV writing is not supported"));
    }
}

export class WebSocketCommandBatch implements ICommandBatch {
    private _batch: messages.TransportMessage[] = [];

    constructor(private readonly _commit: (requests: messages.TransportMessage[])=>Promise<void>) {

    }

    async commit()
    {
        const batch = this._batch;
        this._batch = null;
        if (!batch) throw new CommandStationError("Command batch already committed");
        await this._commit(batch);
        log.verbose("Committed command batch");
    }
    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): void {
        log.verbose(() => `setLocomotiveSpeed - locoId=${locomotiveId}, speed=${speed}, reverse=${!!reverse}`);
    }

    setLocomotiveFunction(locomotiveId: number, func: number, action: FunctionAction): void {
        log.verbose(() => `setLocomotiveFunction - locoId=${locomotiveId}, function=${func}, action=${FunctionAction[action]}`);
    }

    writeRaw(data: Buffer | number[]): void {
        throw new CommandStationError("Raw writes are not unsupported");
    }
}