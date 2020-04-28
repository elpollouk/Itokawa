import { Logger } from "../../utils/logger";
import { CommandStationError, ICommandBatch, CommandStationState, CommandStationBase } from "./commandStation"
import { AsyncSerialPort } from "../asyncSerialPort";
import { encodeLongAddress, ensureCvNumber, ensureByte } from "./nmraUtils";
import { toHumanHex } from "../../utils/hex";
import { parseConnectionString } from "../../utils/parsers";
import { padLeadingZero } from "../../utils/padding";
import { timeout } from "../../utils/promiseUtils";

const log = new Logger("eLink");

let Config = {
    heartbeatTime: 5
}

enum MessageType {
    HANDSHAKE_STATUS = 0x01,
    INFO_REQ = 0x21,
    CV_SELECT_REQUEST = 0x22,
    CV_WRITE_REQUEST = 0x23,
    HANDSHAKE_EXCHANGE = 0x35,
    HANDSHAKE_KEY = 0x3A,
    CV_SELECT_RESPONSE = 0x61,
    INFO_RESPONSE = 0x62,
    CV_VALUE_RESPONSE = 0x63,
    LOCO_COMMAND = 0xE4
}

enum LocoCommand {
    SET_SPEED = 0x13
}

const SUPPORTED_VERSIONS = new Set([
    105, // 1.05 - Untested by me but reported working (Issue #20)
    107  // 1.07
]);

function ensureValidMessage(message: number[], type?:MessageType) {
    let checkSum = 0;
    for (let i = 0; i < message.length; i++) {
        checkSum ^= message[i];
    }
    if (checkSum != 0) throw new CommandStationError("Invalid checksum for received message");

    if (type && message[0] != type) throw new CommandStationError(`Unexpected message type, expected ${type}, but got ${message[0]}`);
}

export function applyChecksum(message: number[] | Buffer) {
    // Interestingly, the eLink doesn't seem to verify checksums and will accept
    // any valid-ish message without complaining.
    let checkSum = 0;
    for (let i = 0; i < message.length - 1; i++)
        checkSum ^= message[i];

    message[message.length - 1] = checkSum;

    return message
}

function updateHandshakeMessage(data: number[]) {
    // Modification of original eLink message has been observed to be +0x39 on
    // multiple machines. 0x39 could be the checksum of the previous message
    // the software sent the eLink, or it could be a hard coded value
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

    constructor(private _connectionString: string) {
        super(log);
    }

    async init() {
        try {
            this._ensureState(CommandStationState.UNINITIALISED);
            const config = parseConnectionString(this._connectionString);
            if (!config.port) throw new CommandStationError("\"port\" not specified in connection string");

            this._setState(CommandStationState.INITIALISING);
            log.info(`Opening port ${config.port}...`);
            this._port = await AsyncSerialPort.open(config.port, {
                baudRate: 115200
            });
            this._port.on("error", (err) => this._onError(err));

            await this._sendStatusRequest();   
            await this._sendVersionInfoRequest();

            this._scheduleHeartbeat();
            this._setIdle();

            log.info("Initialisation complete");
        }
        catch (error) {
            if (this._port) {
                this._port.saveDebugSanpshot();
                await this._port.close();
                this._port = null;
            }
            throw error;
        }
    }

    private _onError(error: Error) {
        this._port.saveDebugSanpshot();
        this._setState(CommandStationState.ERROR);
        this.emit("error", error);
    }

    async close() {
        if (this.state === CommandStationState.UNINITIALISED) return;

        log.info("Closing connection...");
        this._setState(CommandStationState.SHUTTING_DOWN);
        this._cancelHeartbeart();
        await this._port.close();
        this._port = null;
        this._setState(CommandStationState.UNINITIALISED);
        log.info("Closed");
    }

    async writeRaw(data: Buffer | number[]) {
        await this._requestIdleToBusy();
        await this._port.write(data);
        this._setIdle();
    }

    async _ensureCvSelected() {
        // We get the next message multiple times
        let resMessage: number[];
        do {
            resMessage = await this._port.read(3);
            ensureValidMessage(resMessage, MessageType.CV_SELECT_RESPONSE);
        } while (resMessage[1] === 2);
        if (resMessage[1] !== 1) throw new Error(`Unexpected message: ${toHumanHex(resMessage)}`);


        // Then another batch of confirmation messages.
        // The eLink is really annoying as we have no idea how many of these we'll receive, could be 3, could be 4
        // We need to wait a bit and see if there are any more messages in the buffer before we can continue
        while (true) {
            // TODO - Add timeout support to reads
            if (this._port.bytesAvailable === 0) {
                await timeout(0.5);
                if (this._port.bytesAvailable === 0) break;
            }
            resMessage = await this._port.read(3);
            ensureValidMessage(resMessage, MessageType.CV_SELECT_RESPONSE);
            if (resMessage[1] !== 1) throw new Error(`Unexpected message: ${toHumanHex(resMessage)}`);
        }
    }

    async _readCurrentCvValue(verificationCv: number): Promise<number> {
        // CV is selected, now request its value
        await this._port.write([MessageType.INFO_REQ, 0x10, 0x31]);

        // Ensure a value is read from the command station
        let resMessage = await this._port.read(1);
        if (resMessage[0] === MessageType.CV_SELECT_RESPONSE) {
            // Read in the rest of the error message to remove it from the buffer
            await this._port.read(2);
            throw new Error(`Failed to read CV ${verificationCv}`);
        }
        else if (resMessage[0] !== MessageType.CV_VALUE_RESPONSE) {
            // We don't know what this message is, so the buffer is likely full of junk now
            // The eLink will need to be physically reset.
            throw new Error(`Unexpected CV value response: ${toHumanHex(resMessage)}`);
        }
        resMessage = await this._port.concatRead(resMessage, 4);
        ensureValidMessage(resMessage);

        // Ensure the correct CV was read
        if (resMessage[2] !== verificationCv)
            throw new Error(`Received value for CV ${resMessage[2]} but expected CV ${verificationCv}`);
        return resMessage[3];
    }

    async readLocoCv(cv: number) {
        ensureCvNumber(cv);

        await this._requestIdleToBusy();
        try {
            this._cancelHeartbeart();

            // Select the CV we want to read from
            let reqMessage = applyChecksum([MessageType.CV_SELECT_REQUEST, 0x15, cv, 0]);
            await this._port.write(reqMessage);
            await this._ensureCvSelected();

            const value = await this._readCurrentCvValue(cv);

            await this._sendStatusRequest();
            return value;
        }
        finally {
            this._scheduleHeartbeat();
            this._setIdle();
        }
    }

    async writeLocoCv(cv: number, value: number) {
        ensureCvNumber(cv);
        ensureByte(value);

        await this._requestIdleToBusy();
        try {
            this._cancelHeartbeart();

            // Select the CV we want to write to
            let reqMessage = applyChecksum([MessageType.CV_WRITE_REQUEST, 0x16, cv, value, 0]);
            await this._port.write(reqMessage);
            await this._ensureCvSelected();

            // Verify value was written correctly
            const writtenValue = await this._readCurrentCvValue(cv);
            log.debug(() => `Read back value: ${toHumanHex([writtenValue])}`)
            if (writtenValue !== value)
                throw new Error(`Failed to write CV ${cv}`);

            await this._sendStatusRequest();
        }
        finally {
            this._scheduleHeartbeat();
            this._setIdle();
        }
    }
    
    async beginCommandBatch() {
        log.info("Starting command batch");
        return new ELinkCommandBatch(this._commitCommandBatch.bind(this));
    };

    private async _commitCommandBatch(batch: number[][]) {
        log.info("Committing command batch...")

        await this._requestIdleToBusy();
        try {
            // We need to cancel heartbeats when sending commands as we write a heartbeat request
            // at the end of the batch anyway.
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
        log.verbose(`Scheduling next heartbeat in ${Config.heartbeatTime}s`);
        this._heartbeatToken = setTimeout(() => {

            log.verbose("Requesting hearbeat...");
            // It's theoretically possible for this event to fire while we're already writing to the port.
            // In this case, abort the request and rely on the current port user to schedule the next
            // heartbeat.
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

                // Heartbeat failed, so assume the device connection has also failed and flag error
                log.error(`Failed sending heartbeat request: ${err}`);
                log.error(err.stack);
                this._onError(err);

            });

        }, Config.heartbeatTime * 1000);
    }

    private _cancelHeartbeart() {
        clearTimeout(this._heartbeatToken);
        this._heartbeatToken = null;
    }

    private async _sendStatusRequest() {
        await this._port.write([MessageType.INFO_REQ, 0x24, 0x05]);
        await this._disbatchResponse();
    }

    private async _disbatchResponse() {
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

        log.info("Received handshake request");

        // I'm assuming the string is a key, but it seems to be the same for all computers
        await this._port.write([MessageType.HANDSHAKE_KEY, 0x36, 0x34, 0x4A, 0x4B, 0x44, 0x38, 0x39, 0x42, 0x53, 0x54, 0x39]);
        data = await this._port.read(7);
        ensureValidMessage(data, MessageType.HANDSHAKE_EXCHANGE);
        log.info("Received check bytes");

        // We received a series of bytes that we need to modify and send back in order to
        // complete the handshake
        updateHandshakeMessage(data);
        await this._port.write(data);
        data = await this._port.read(3);
        ensureValidMessage(data, MessageType.HANDSHAKE_STATUS);
        if (data[1] != 0x04) throw new CommandStationError("Handshake failed");

        log.info("Handshake complete");
    }

    private async _handleInfoResponse(data: number[]) {
        // This seems to be a generic "OK" message, I've never seen it change
        data = await this._port.concatRead(data, 3);
        ensureValidMessage(data);

        if (data[1] != 0x22 || data[2] != 0x40)
            throw new CommandStationError(`Unrecognised INFO_RESPONSE, got ${toHumanHex(data)}`);

        log.verbose("Received status OK response");
    }

    private async _sendVersionInfoRequest() {
        log.info("Sending info request");

        await this._port.write([MessageType.INFO_REQ, 0x21, 0x00]);
        const data = await this._port.read(5);
        ensureValidMessage(data);

        // I'm sure all the fields in this message contain interesting info, but I have no indication
        // what they are. At a guess, possibly a firmware checksum to verify updates.
        const version = data[2];
        if (!SUPPORTED_VERSIONS.has(version))
            throw new CommandStationError(`Unsupported eLink version encountered, version=${version}`);

        const major = Math.trunc(version / 100);
        const minor = Math.trunc(version - (major * 100));
        this._version = `${major}.${padLeadingZero(minor, 2)}`;

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
        if (locomotiveId < 100) {
            // Short addresses can be written directly into the packet
            command[3] = locomotiveId;
        }
        else {
            encodeLongAddress(locomotiveId, command, 2);
        }

        speed &= 0x7F;
        if (!reverse) speed |= 0x80;
        command[4] = speed;
            
        this._addCommand(command);
    }

    writeRaw(data: Buffer | number[]) {
        if (!data) throw new CommandStationError("Attempted to write null/undefined data");
        if (data.length === 0) throw new CommandStationError("Attempted to write empty data")
        if (data instanceof Buffer) {
            const d = [];
            for (let i = 0; i < data.length; i++)
                d.push(data[i]);
            data = d;
        }
        this._commands.push(data);
    }

    private _addCommand(command: number[]) {
        if (!this._commands) throw new CommandStationError("Batch has already been committed");
        applyChecksum(command);
        this._commands.push(command);
    }
}