import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation, FunctionAction, CommandStationError } from "./commandStation";
import { parseConnectionString } from "../../utils/parsers";
import { ensureCvNumber, ensureByte } from "./nmraUtils";
import * as WebSocket from "ws";

const log = new Logger("WebSocketCommandStation");

export class WebSocketCommandStation extends CommandStationBase {
    static readonly deviceId = "WebSocketCommandStation";
    readonly version: string = "1.0.0"
    readonly deviceId: string = WebSocketCommandStation.deviceId;

    readonly url: string = null;
    private _ws: WebSocket = null;

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
    }

    async connect() {
        await this._untilIdle();
    }

    private _onOpen() {
        if (this.state !== CommandStationState.INITIALISING) {
            this._onError(new CommandStationError("WebSocket received unexpected open event"));
        }
        else {
            this._setIdle();
        }
    }

    private _onClose(reason: string) {
        if (this.state != CommandStationState.SHUTTING_DOWN) {
            this._setError(new CommandStationError(`WebSocket closed unexpectedly. Reason: ${reason}`));
        }
        else {
            this._setState(CommandStationState.NOT_CONNECTED);
        }
    }

    private _onError(err: Error) {
        this._setError(err);
    }

    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    beginCommandBatch(): Promise<ICommandBatch> {
        throw new Error("Method not implemented.");
    }

    readLocoCv(cv: number): Promise<number> {
        return Promise.reject(new Error("CV reading is not supported"));
    }

    writeLocoCv(cv: number, value: number): Promise<void> {
        return Promise.reject(new Error("CV writing is not supported"));
    }
}

export class WebSocketCommandBatch implements ICommandBatch {
    constructor(private readonly _commit: ()=>Promise<void>) {

    }

    async commit()
    {
        await this._commit();
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