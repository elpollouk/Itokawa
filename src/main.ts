import { Logger, LogLevel } from "./utils/logger";
import { timeout } from "./utils/promiseUtils";
import { DeviceEnumerator } from "./devices/deviceEnumerator";

Logger.logLevel = LogLevel.DEBUG;
let log = new Logger("Main");

async function main()
{
    log.display("Searching for devices...");
    
    let devices = await DeviceEnumerator.listDevices();

    if (devices.length == 0) {
        log.error("No devices found, exiting.");
        return
    }
    let device = devices[0]

    log.display(`Found ${device.name}`);
    let cs = await device.open();
    log.display(`Connected to ${cs.deviceId} ${cs.version}!`);

    log.display("Starting locos...");
    let batch = await cs.beginCommandBatch();
    batch.setLocomotiveSpeed(2732, 64);
    batch.setLocomotiveSpeed(4305, 96);
    await batch.commit();

    await timeout(30);

    log.display("Stopping locos...");
    batch = await cs.beginCommandBatch();
    batch.setLocomotiveSpeed(2732, 0);
    batch.setLocomotiveSpeed(4305, 0);
    await batch.commit();

    log.display("Shutting down...");
    await cs.close();
} 


main().then(() => {
    log.display("Done.");
}, (err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});