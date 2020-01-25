import { Logger, LogLevel } from "./utils/logger";
import { DeviceEnumerator, Device } from "./deviceEnumerator";

Logger.logLevel = LogLevel.DEBUG;
let log = new Logger("Main");

function ensureValidMessage(message: number[]) {
    let checkSum = 0;
    for (let i = 0; i < message.length; i++) {
        checkSum ^= message[i];
    }
    if (checkSum != 0) throw new Error("Invalid checksum");
}

function applyChecksum(message: number[]) {
    let checkSum = 0;
    for (let i = 0; i < message.length - 1; i++) {
        checkSum ^= message[i];
    }
    message[message.length - 1] = checkSum;
}

function updateHandshakeMessage(data: number[]) {
    let checksum = 0;
    data[0] = 0x35;
    for (let i = 1; i < 6; i++) {
        data[i] = (data[i] + 0x39) & 0xFF;
    }
    applyChecksum(data);
}

async function main()
{
    log.info("Initialising...");
    
    var enumerator = new DeviceEnumerator();
    let devices = await enumerator.listDevices();

    if (devices.length == 0) {
        log.error("No ports found, exiting.");
        return
    }

    let device: Device = null;
    for (let p of devices) {
        if (p.potentialDevices.length != 0) {
            device = p;
            break;
        }
    }

    if (device === null) {
        log.error("No recognised devices found, exiting.");
        return;
    }

    log.info(`Opening port ${device.path}...`);
    
    let port = await device.open();

    await port.write([0x21, 0x24, 0x05]);
    let data = await port.read(1);

    if (data[0] == 0x01) {
        data = await port.concatRead(data, 2);
        ensureValidMessage(data);
        log.info("Received handshake request");

        await port.write([0x3A, 0x36, 0x34, 0x4A, 0x4B, 0x44, 0x38, 0x39, 0x42, 0x53, 0x54, 0x39]);
        data = await port.read(7);
        ensureValidMessage(data);
        log.info("Received check bytes");
        updateHandshakeMessage(data);

        await port.write(data);
        data = await port.read(3);
        ensureValidMessage(data);
        log.info("Handshake complete");
    }
    else if (data[0] == 0x62) {
        data = await port.concatRead(data, 3);
        ensureValidMessage(data);
        log.info("Received OK response");
    }
    else {
        throw new Error(`Unrecognised response code ${data[0]}`);
    }

    log.info("Sending info request");
    await port.write([0x21, 0x21, 0x00]);
    data = await port.read(5);
    ensureValidMessage(data);

    let major = Math.trunc(data[2] / 100);
    let minor = Math.trunc(data[2] - (major * 100));
    log.info(`eLink version ${major}.${minor <= 9 ? "0" : ""}${minor}`);

    log.info("eLink ready for use");
        
    port.close();
} 


main().then(() => {
    log.info("Done.");
}, (err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});