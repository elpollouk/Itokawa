import { Logger } from "../../utils/logger";
import { CommandStationError, ICommandBatch, CommandStationState, CommandStationBase } from "./commandStation"
import { AsyncSerialPort } from "../asyncSerialPort";
import { encodeLongAddress } from "./nmraUtils";
import { toHumanHex } from "../../utils/hex";

const log = new Logger("eLink");

let Config = {
    heartbeatTime: 5
}

enum MessageType {
    HANDSHAKE_STATUS = 0x01,
    INFO_REQ = 0x21,
    HANDSHAKE_EXCHANGE = 0x35,
    HANDSHAKE_KEY = 0x3A,
    INFO_RESPONSE = 0x62,
    LOCO_COMMAND = 0xE4
}

enum LocoCommand {
    SET_SPEED = 0x13
}

const SUPPORTED_VERSIONS = new Set([
    0x6B // 1.07
]);

function ensureValidMessage(message: number[], type?:MessageType) {
    let checkSum = 0;
    for (let i = 0; i < message.length; i++) {
        checkSum ^= message[i];
    }
    if (checkSum != 0) throw new CommandStationError("Invalid checksum for received message");

    if (type && message[0] != type) throw new CommandStationError(`Unexpected message type, expected ${type}, but got ${message[0]}`);
}

function applyChecksum(message: number[] | Buffer) {
    let checkSum = 0;
    for (let i = 0; i < message.length - 1; i++)
        checkSum ^= message[i];

    message[message.length - 1] = checkSum;
}

function updateHandshakeMessage(data: number[]) {
    data[0] = MessageType.HANDSHAKE_EXCHANGE;
    for (let i = 1; i < 6; i++)
        data[i] = (data[i] + 0x39) & 0xFF;

    applyChecksum(data);
}

export class ELinkCommandStation extends CommandStationBase {
    static readonly deviceId = "eLink";
    static config = Config;

    static async open(connectionString: string) {
        let cs = new ELinkCommandStation(connectionString);
        await cs.init();
        return cs;
    }

    readonly deviceId = ELinkCommandStation.deviceId;

    private _port: AsyncSerialPort = null;
    private _version: string = "";
    private _heartbeatToken: NodeJS.Timeout = null;

    get version(): string { return this._version; }

    constructor(private _portPath: string) {
        super(log);
    }

    async init() {
        this._ensureState(CommandStationState.UNINITIALISED);

        this._setState(CommandStationState.INITIALISING);
        log.info(`Opening port ${this._portPath}...`);
        this._port = await AsyncSerialPort.open(this._portPath, {
            baudRate: 115200
        });
        this._port.on("error", (err) => {
            this.emit("error", err);
        });

        await this._sendStatusRequest();   
        await this._sendVersionInfoRequest();

        this._scheduleHeartbeat();
        this._setIdle();

        log.info("Initialisation complete");
    }

    async close() {
        log.info("Closing connection...");
        this._setState(CommandStationState.SHUTTING_DOWN);
        this._cancelHeartbeart();
        await this._port.close();
        this._port = null;
        this._setState(CommandStationState.UNINITIALISED);
        log.info("Closed");
    }
    
    async beginCommandBatch() {
        log.info("Starting command batch");
        return new ELinkCommandBatch(this._commitCommandBatch.bind(this));
    };

    private async _commitCommandBatch(batch: number[][]) {
        log.info("Committing command batch...")
        await this._untilIdle();
        
        try {
            this._setBusy();
            this._cancelHeartbeart();

            for (let command of batch)
                await this._port.write(command);

            await this._sendStatusRequest();
            log.info("Committed command batch successfully")
        }
        finally {
            this._scheduleHeartbeat();
            this._setIdle();
        }
    }

    private _scheduleHeartbeat() {
        if (this._heartbeatToken) throw new CommandStationError("Heartbeat already schedulled");

        log.info(`Scheduling next heartbeat in ${Config.heartbeatTime}s`);
        this._heartbeatToken = setTimeout(() => {

            log.info("Requesting hearbeat...");
            if (this.state != CommandStationState.IDLE) {
                log.error(`eLink in invalid state for heartbeat, state=${CommandStationState[this.state]}`);
                return;
            }
            this._setBusy();

            this._sendStatusRequest().then(() => {

                this._heartbeatToken = null;
                this._scheduleHeartbeat();
                this._setIdle();

            }, (err) => {

                log.error(`Failed sending heartbeat request: ${err}`);
                if (err.stack) log.error(err.stack);
                this._setState(CommandStationState.ERROR);
                this.emit("error", err);

            });

        }, Config.heartbeatTime * 1000);
    }

    private _cancelHeartbeart() {
        if (this._heartbeatToken) {
            clearTimeout(this._heartbeatToken);
            this._heartbeatToken = null;
        }
    }

    private async _sendStatusRequest() {
        await this._port.write([MessageType.INFO_REQ, 0x24, 0x05]);
        await this._dispathResponse();
    }

    private async _dispathResponse() {
        let data = await this._port.read(1);
    
        switch (data[0])
        {
        case MessageType.HANDSHAKE_STATUS:
            await this._handleHandshake(data);
            break;
        
        case MessageType.INFO_RESPONSE:
            await this._handleInfoResponse(data);
            break;
        
        default:
            const message = `Unrecognised message type, got ${data[0]}`;
            log.error(message);
            throw new CommandStationError(message);
        }
    }

    private async _handleHandshake(data: number[]) {
        data = await this._port.concatRead(data, 2);
        ensureValidMessage(data, MessageType.HANDSHAKE_STATUS);

        if (data[1] != 0x04) {
            log.info("Received handshake request");

            await this._port.write([MessageType.HANDSHAKE_KEY, 0x36, 0x34, 0x4A, 0x4B, 0x44, 0x38, 0x39, 0x42, 0x53, 0x54, 0x39]);
            data = await this._port.read(7);
            ensureValidMessage(data, MessageType.HANDSHAKE_EXCHANGE);
            log.info("Received check bytes");

            updateHandshakeMessage(data);
            await this._port.write(data);
            data = await this._port.read(3);
            ensureValidMessage(data, MessageType.HANDSHAKE_STATUS);
            if (data[1] != 0x04) throw new CommandStationError("Handshake failed");
        }
        log.info("Handshake complete");
    }

    private async _handleInfoResponse(data: number[]) {
        data = await this._port.concatRead(data, 3);
        ensureValidMessage(data);

        if (data[1] != 0x22 || data[2] != 0x40)
            throw new CommandStationError(`Unrecognised INFO_RESPONSE, got ${toHumanHex(data)}`);

        log.info("Received status OK response");
    }

    private async _sendVersionInfoRequest() {
        log.info("Sending info request");

        await this._port.write([MessageType.INFO_REQ, 0x21, 0x00]);
        const data = await this._port.read(5);
        ensureValidMessage(data);

        const version = data[2];
        if (!SUPPORTED_VERSIONS.has(version))
            throw new CommandStationError(`Unsupported eLink version encountered, version=${version}`);

        const major = Math.trunc(version / 100);
        const minor = Math.trunc(version - (major * 100));
        this._version = `${major}.${minor <= 9 ? "0" : ""}${minor}`;

        log.info(() => `Version: ${this.version}`);
    }
}

export class ELinkCommandBatch implements ICommandBatch {
    private _commands: number[][] = [];

    constructor(private readonly _commit: (batch: number[][]) => Promise<void>) {

    }

    async commit() {
        if (!this._commands) throw new CommandStationError("Batch has already been committed");
        if (this._commands.length === 0) throw new CommandStationError("Attempted to commit empty batch");
        await this._commit(this._commands);
        this._commands = null;
    }
    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean) {
        log.info(() => `Setting loco ${locomotiveId} to speed ${speed}, reverse=${reverse || false}`);
        if (speed < 0 || speed > 127) throw new CommandStationError(`Invalid speed requested, speed=${speed}`);

        let command = [ MessageType.LOCO_COMMAND, LocoCommand.SET_SPEED, 0x00, 0x00, 0x00, 0x00 ];
        encodeLongAddress(locomotiveId, command, 2);
        speed &= 0x7F;
        if (!reverse) speed |= 0x80;
        command[4] = speed;
            
        this._addCommand(command);
    }

    private _addCommand(command: number[]) {
        if (!this._commands) throw new CommandStationError("Batch has already been committed");
        applyChecksum(command);
        this._commands.push(command);
    }
}