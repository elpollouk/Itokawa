import { Logger } from "../../utils/logger";
import { CommandStationError, ICommandBatch, CommandStationState, CommandStationBase } from "./commandStation"
import { AsyncSerialPort } from "../asyncSerialPort";
import { toHumanHex } from "../../utils/hex";
import { parseConnectionString, parseIntStrict } from "../../utils/parsers";

const log = new Logger("Raw");

export class RawCommandStation extends CommandStationBase {
    static readonly deviceId = "Raw";
    
    static async open(connectionString: string) {
        let cs = new RawCommandStation(connectionString);
        await cs.init();
        return cs;
    }
    
    readonly version = "1.0.0";
    readonly deviceId = RawCommandStation.deviceId;

    private _port: AsyncSerialPort = null;

    constructor(private _connectionString: string) {
        super(log)
    }

    private async init() {
        this._ensureState(CommandStationState.UNINITIALISED);
        const config = parseConnectionString(this._connectionString, {
            baud: parseIntStrict,
            dataBits: parseIntStrict,
            stopBits: parseIntStrict
        });
        if (!config.port) throw new CommandStationError("\"port\" not specified in connection string");

        this._setState(CommandStationState.INITIALISING);
        log.info(`Opening port ${config.port}...`);
        this._port = await AsyncSerialPort.open(config.port, {
            baudRate: config.baud || 115200,
            dataBits: config.dataBits || 8,
            stopBits: config.stopBits || 1,
            parity: config.parity || "none"
        });

        this._port.on("error", (err) => {
            log.error(`Serial port error: ${err.message}`);
            log.error(`Stack: ${err.stack}`);
            this.emit("error", err);
        });
        this._port.on("data", (data: Buffer) => {
            log.info(() => `Data: size=${data.length}, bytes=${toHumanHex(data)}`)
            this.emit("data", data);
        });

        this._setIdle();
    }

    async close(): Promise<void> {
        this._setState(CommandStationState.SHUTTING_DOWN);
        await this._port.close();
        this._port = null;
        this._setState(CommandStationState.UNINITIALISED);
        log.info("Closed");
    }

    beginCommandBatch(): Promise<ICommandBatch> {
        return Promise.reject(new Error("Method not implemented."));
    }

    async writeRaw(data: Buffer | number[]) {
        this._ensureIdle();
        this._setBusy();
        try {
            await this._port.write(data);
        }
        finally {
            this._setIdle();
        }
    }
}