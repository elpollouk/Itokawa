import { Logger } from "../../utils/logger";
import { EventEmitter } from "events";
import { ICommandStation, CommandStationError } from "./commandStation"
import { AsyncSerialPort } from "../asyncSerialPort";
import { encodeLongAddress } from "./nmraUtils";

const log = new Logger("eLink");

export const Config = {
    heartbeatTime: 5
}

export enum ElinkState {
    UNINITIALISED = 0,
    INITIALISING = 1,
    IDLE = 2,
    BUSY = 3,
    ERROR = 4,
    SHUTTING_DOWN = 5
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

function ensureValidMessage(message: number[], type?:MessageType) {
    let checkSum = 0;
    for (let i = 0; i < message.length; i++) {
        checkSum ^= message[i];
    }
    if (checkSum != 0) throw new Error("Invalid checksum");

    if (type && message[0] != type) throw new Error(`Unexpected message type, expected ${type}, but got ${message[0]}`);
}

function applyChecksum(message: number[] | Buffer) {
    let checkSum = 0;
    for (let i = 0; i < message.length - 1; i++) {
        checkSum ^= message[i];
    }
    message[message.length - 1] = checkSum;
}

function updateHandshakeMessage(data: number[]) {
    let checksum = 0;
    data[0] = MessageType.HANDSHAKE_EXCHANGE;
    for (let i = 1; i < 6; i++) {
        data[i] = (data[i] + 0x39) & 0xFF;
    }
    applyChecksum(data);
}

export class ELink extends EventEmitter implements ICommandStation {
    static readonly DEVICE_ID = "eLink";

    private _state: ElinkState = ElinkState.UNINITIALISED;
    private _port: AsyncSerialPort = null;
    private _version: string = "";
    private _heartbeatToken: NodeJS.Timeout = null;

    get state(): ElinkState { return this._state; }
    get version(): string { return this._version; }

    constructor(private _portPath: string) {
        super();
    }

    async init() {
        this._ensureState(ElinkState.UNINITIALISED);

        this._setState(ElinkState.INITIALISING);
        log.info(`Opening port ${this._portPath}...`);
        this._port = await AsyncSerialPort.open(this._portPath, {
            baudRate: 115200
        });

        await this._sendStatusRequest();   
        await this._fetchVersionInfoRequest();

        this._scheduleHeartbeat();

        this._setState(ElinkState.IDLE);
        log.info("Initialisation complete");
    }

    async close() {
        this._setState(ElinkState.SHUTTING_DOWN);
        this._cancelHeartbeart();
        await this._port.close();
        this._port = null;
        this._setState(ElinkState.UNINITIALISED);
    }
    
    async commitCommands() {
        try {
            log.info("Committing commands...")
            await this._runRequest(async () => {
                await this._sendStatusRequest();
            });
            log.info("Committed commands successfully")
        }
        finally {
            this._scheduleHeartbeat();
        }
    }

    async setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean) {
        log.info(() => `Setting loco ${locomotiveId} to speed ${speed}, reverse=${reverse}`);
        if (speed < 0 || speed > 127) throw new CommandStationError(`Invalid speed requested, speed=${speed}`);

        await this._runRequest(async () => {
            let request = [ MessageType.LOCO_COMMAND, LocoCommand.SET_SPEED, 0x00, 0x00, 0x00, 0x00 ];
            encodeLongAddress(locomotiveId, request, 2);
            speed &= 0x7F;
            if (!reverse) speed |= 0x80;
            request[4] = speed;
            applyChecksum(request);

            await this._port.write(request);
        });
    }

    private _setState(state: ElinkState) {
        const prevState = this._state;
        this._state = state;
        log.debug(`State changing from ${prevState} to ${state}`);
        this.emit("state", this._state, prevState);
    }

    private async _runRequest(requestFunc: () => Promise<void>) {
        this._ensureReady();
        this._cancelHeartbeart();
        this._setState(ElinkState.BUSY);
        try {
            await requestFunc();
        }
        finally {
            this._setState(ElinkState.IDLE);
        }
    }

    private _ensureState(currentState: ElinkState) {
        if (this._state != currentState) throw new Error(`eLink in wrong state for requested operation, state=${this._state}`)
    }

    private _ensureReady() {
        this._ensureState(ElinkState.IDLE);
    }

    private _scheduleHeartbeat() {
        if (this._heartbeatToken) throw new Error("Heartbeat already schedulled");

        log.info(`Scheduling next heartbeat in ${Config.heartbeatTime}s`);
        this._heartbeatToken = setTimeout(() => {

            log.info("Requesting hearbeat...");
            if (this._state != ElinkState.IDLE) {
                log.error(`eLink in invalid state for heartbeat, state=${this.state}`);
                return;
            }
            this._setState(ElinkState.BUSY);

            this._sendStatusRequest().then(() => {

                this._heartbeatToken = null;
                this._scheduleHeartbeat();
                this._setState(ElinkState.IDLE);

            }, (err) => {

                log.error(`Failed sending heartbeat request: ${err}`);
                if (err.stack) log.error(err.stack);
                this._setState(ElinkState.ERROR);
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
            throw new Error(message);
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
            if (data[1] != 0x04) throw new Error("Handshake failed");
        }
        log.info("Handshake complete");
    }

    private async _handleInfoResponse(data: number[]) {
        data = await this._port.concatRead(data, 3);
        ensureValidMessage(data);

        if (data[1] != 0x22 || data[2] != 0x40) throw new Error(`Unrecognised INFO_RESPONSE, got ${data}`);

        log.info("Received status OK response");
    }

    private async _fetchVersionInfoRequest() {
        log.info("Sending info request");

        await this._port.write([MessageType.INFO_REQ, 0x21, 0x00]);
        const data = await this._port.read(5);
        ensureValidMessage(data);

        const major = Math.trunc(data[2] / 100);
        const minor = Math.trunc(data[2] - (major * 100));
        this._version = `${ELink.DEVICE_ID} ${major}.${minor <= 9 ? "0" : ""}${minor}`;

        log.info(() => `Version: ${this.version}`);
    }
}