import { Logger } from "../utils/logger";
import * as SerialPort from "serialport";
import { ICommandStation, ICommandStationConstructable } from "./commandStations/commandStation";
import { CommanderStatic } from "commander";
import { application } from "../application";

let log = new Logger("Device");

const DEVICE_RETRY_TIME = 5000;

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

    static async monitorForDevice(args: CommanderStatic) {
        // This will start monitoring for device errors and attempt recovery
        const errorHandler = (err: Error) => {
            if (application.commandStation) {
                // Remove the error handler to avoid memory leaks associated with it
                application.commandStation.off("error", errorHandler);
            }

            log.error("Command station error");
            log.error(err.stack);

            const retryTime = application.config.getAs("application.commandStation.retryTime", DEVICE_RETRY_TIME);
            log.info(`Schedulling retry in ${retryTime}ms`);
            setTimeout(() => this.monitorForDevice(args), retryTime);
        };

        try {
            if (application.commandStation) await application.commandStation.close();
            log.info("Attempting to open device...");
            application.commandStation = await this._detectDevice(args);
            log.display(`Using ${application.commandStation.deviceId} ${application.commandStation.version}`);

            application.commandStation.on("error", errorHandler);
        }
        catch (err) {
            errorHandler(err);
        }
    }

    private static async _detectDevice(args: CommanderStatic): Promise<ICommandStation> {
        // Allow command line args to override everything
        if (args.device) {
            return await DeviceEnumerator.openDevice(args.device, args.connectionString);
        }

        // Check if a specific command station config has been provided
        const deviceName = application.config.getAs<string>("application.commandStation.device");
        if (deviceName) {
            const connectionString = application.config.getAs<string>("application.commandStation.connectionString");
            return await DeviceEnumerator.openDevice(deviceName, connectionString);
        }

        // Nothing explicit has been configured, try auto detecting a command station
        const devices = await DeviceEnumerator.listDevices();
        if (devices.length === 0) throw Error("No command stations found");

        return await devices[0].open();
    }
}
