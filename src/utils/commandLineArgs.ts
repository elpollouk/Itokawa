import { CommanderStatic } from "commander";
import { Logger, LogLevel } from "./logger";
import { DeviceEnumerator } from "../devices/deviceEnumerator";

export function addCommonOptions(commander: CommanderStatic) {
    commander
        .option("-d --device <device>", "Device to open.")
        .option("-c --connection-string <connectionString>", "Port to open device on.")
        .option("--log-level <loglevel>", "Log level");
}

export async function openDevice(commander: CommanderStatic) {
    if (commander.device) {
        return await DeviceEnumerator.openDevice(commander.device, commander.connectionString);
    }

    let devices = await DeviceEnumerator.listDevices();
    if (devices.length == 0) {
        return null;
    }

    console.log(`Using ${devices[0].commandStation}`);
    return await devices[0].open();
}

export function applyLogLevel(commander: CommanderStatic) {
    const ll = (commander.logLevel || "").toUpperCase();
    if (ll in LogLevel) {
        Logger.logLevel = LogLevel[ll as string];
    }
}