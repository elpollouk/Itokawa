import { Logger } from "./utils/logger";
import * as SerialPort from "serialport";
import { ICommandStation } from "./devices/commandStations/commandStation";
import { ELink } from "./devices/commandStations/elink";

let log = new Logger("Device");

let deviceMap = {
    "Microchip Technology, Inc.": [ELink],
    "Microchip Technology Inc.": [ELink]
}

type commandStationConnector = () => Promise<ICommandStation>;

export interface Device {
    name: string;
    commandStation: string;
    path: string;
    manufacturer: string;
    pnpId: string;
    connect: commandStationConnector;
}

export class DeviceEnumerator {
    async listDevices(): Promise<Device[]> {
        let ports = await SerialPort.list();

        let devices: Device[] = [];
        for (const port of ports) {
            log.info(() => `Found ${port.path}, manufacturer=${port.manufacturer}, pnpId=${port.pnpId}`);
            let potentialDevices: any[] = (port.manufacturer in deviceMap) ? deviceMap[port.manufacturer] : [];

            for (const deviceClass of potentialDevices)
            {
                devices.push({
                    name: `${deviceClass.DEVICE_ID} on ${port.path}`,
                    commandStation: deviceClass.DEVICE_ID,
                    path: port.path,
                    manufacturer: port.manufacturer,
                    pnpId: port.pnpId,
                    connect: async () => {
                        let cs = new deviceClass(port.path) as ICommandStation;
                        await cs.init();
                        return cs;
                    }
                });
            }
        }

        return devices;
    }
}