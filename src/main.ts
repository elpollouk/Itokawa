import { Logger, LogLevel } from "./utils/logger";
import { timeoutAsync } from "./utils/promiseUtils";
import { DeviceEnumerator } from "./deviceEnumerator";

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
    let device = devices[0]

    log.display(`Found ${device.name}`);
    let cs = await device.connect();
    log.display(`Connected to ${cs.version}!`);

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