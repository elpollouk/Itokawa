import { Logger, LogLevel } from "./utils/logger";
import { timeoutAsync } from "./utils/promiseUtils";
import { DeviceEnumerator } from "./devices/deviceEnumerator";

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

    log.display("Starting locos...");
    await cs.beginCommandBatch();
    await cs.setLocomotiveSpeed(2732, 64);
    await cs.setLocomotiveSpeed(4305, 96);
    await cs.commitCommandBatch();

    await timeoutAsync(120);

    log.display("Stopping locos...");
    await cs.beginCommandBatch();
    await cs.setLocomotiveSpeed(2732, 0);
    await cs.setLocomotiveSpeed(4305, 0);
    await cs.commitCommandBatch();

    log.display("Shutting down....");
    await cs.close();
} 


main().then(() => {
    log.display("Done.");
}, (err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});