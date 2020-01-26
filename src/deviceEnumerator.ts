import { Logger } from "./utils/logger";
import * as SerialPort from "serialport";
import { AsyncSerialPort } from "./devices/asyncSerialPort";

let log = new Logger("Device");

let deviceMap = {
    "Microchip Technology, Inc.": ["eLink"],
    "Microchip Technology Inc.": ["eLink"]
}

export class Device {
    constructor(readonly path: string, readonly potentialDevices: string[]) {
        if (potentialDevices.length == 0) {
            log.info(() => `${path} is not recognised as a device`);
        }
        else {
            log.info(() => `${path} could potentially be:`);
            for (let device of potentialDevices)
                log.info(() => `  ${device}`);
        }
    }
}

export class DeviceEnumerator {
    async listDevices(): Promise<Device[]> {
        let ports = await SerialPort.list();

        let devices: Device[] = [];
        for (const port of ports) {
            log.info(() => `Found ${port.path}, manufacturer=${port.manufacturer}, pnpId=${port.pnpId}`);
            let potentialDevices: string[] = (port.manufacturer in deviceMap) ? deviceMap[port.manufacturer] : [];

            devices.push(new Device(
                port.path,
                potentialDevices
            ));
        }

        return devices;
    }
}