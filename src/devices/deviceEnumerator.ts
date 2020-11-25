import { Logger } from "../utils/logger";
import * as SerialPort from "serialport";
import { ICommandStation, ICommandStationConstructable } from "./commandStations/commandStation";

let log = new Logger("Device");

const deviceManufacturerMap = new Map<string, ICommandStationConstructable[]>();
const deviceIdMap = new Map<string, ICommandStationConstructable>();

function detectCommandStation(port: SerialPort.PortInfo): ICommandStationConstructable[] {
    return deviceManufacturerMap.get(port.manufacturer) || [];
}

export interface Device {
    name: string;
    commandStation: string;
    path: string;
    manufacturer: string;
    pnpId: string;
    open: ()=>Promise<ICommandStation>;
}

export class DeviceEnumerator {

    static registerDevice(device: ICommandStationConstructable, ...manufacturers: string[]) {
        log.info(() => `Registering device ${device.deviceId}`);

        deviceIdMap.set(device.deviceId, device);
        for (const manufacturer of manufacturers) {
            let deviceList = deviceManufacturerMap.get(manufacturer) || [];
            deviceList.push(device);
            deviceManufacturerMap.set(manufacturer, deviceList);
        }
    }

    static async listDevices(): Promise<Device[]> {
        let ports = await SerialPort.list();

        let devices: Device[] = [];
        for (const port of ports) {
            log.info(() => `Found ${port.path}, manufacturer=${port.manufacturer}, pnpId=${port.pnpId}`);
            let potentialDevices = detectCommandStation(port);

            for (const device of potentialDevices)
            {
                devices.push({
                    name: `${device.deviceId} on ${port.path}`,
                    commandStation: device.deviceId,
                    path: port.path,
                    manufacturer: port.manufacturer,
                    pnpId: port.pnpId,
                    open: () => DeviceEnumerator.openDevice(device, `port=${port.path}`)
                });
            }
        }

        return devices;
    }

    static openDevice(deviceId: string | ICommandStationConstructable, connectionString?: string): Promise<ICommandStation> {
        connectionString = connectionString || "";
        let device: ICommandStationConstructable;
        if (typeof deviceId === "string") {
            device = deviceIdMap.get(deviceId);
            if (!device) throw new Error(`Device ${deviceId} not registered`);
        }
        else {
            device = deviceId;
        }

        log.info(() => `Requesting open of device ${device.deviceId} with connection string "${connectionString}"`);
        return device.open(connectionString);
    }
}
