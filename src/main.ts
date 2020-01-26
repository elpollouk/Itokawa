import { Logger, LogLevel } from "./utils/logger";
import { timeoutAsync } from "./utils/promiseUtils";
import { DeviceEnumerator, Device } from "./deviceEnumerator";
import { ELink } from "./devices/commandStations/elink";

Logger.logLevel = LogLevel.DEBUG;
let log = new Logger("Main");

async function main()
{
    log.display("Searching for devices...");
    
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

    log.display(`Found ${device.potentialDevices[0]} on ${device.path}`);
    let cs = new ELink(device.path);

    await cs.init();
    log.display("Up and running!");
    await timeoutAsync(30);

    log.display("Starting shutdown");
    await cs.close();

/*
    log.info("Sending loco reset commands");
    await port.write([0xE4, 0x13, 0xCA, 0xAC, 0x80, 0x11]);
    await port.write([0xE4, 0x13, 0xCA, 0xAC, 0x80, 0x11]);
    await port.write([0xE4, 0x13, 0xCA, 0xAC, 0x80, 0x11]);
    await port.write([0xE4, 0x13, 0xCA, 0xAC, 0x80, 0x11]);
        
    await port.write([0xE4, 0x13, 0xD0, 0xD1, 0x80, 0x76]);
    await port.write([0xE4, 0x13, 0xD0, 0xD1, 0x80, 0x76]);
    await port.write([0xE4, 0x13, 0xD0, 0xD1, 0x80, 0x76]);
    await port.write([0xE4, 0x13, 0xD0, 0xD1, 0x80, 0x76]);
        
    await port.write([0x52, 0x00, 0x8B, 0xD9]);
    await port.write([0x21, 0x24, 0x05]);
*/
} 


main().then(() => {
    log.display("Done.");
}, (err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});