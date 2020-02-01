import { CommanderStatic } from "commander";
import { Logger, LogLevel } from "./logger";
import { DeviceEnumerator } from "../devices/deviceEnumerator";
let pjson = require('../../package.json');

export function addCommonOptions(commander: CommanderStatic) {
    commander
        .version(pjson.version)
        .option("-d --device <device>", "Device type to open.")
        .option("-c --connection-string <connectionString>", "Connection configuration string.")
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

    return await devices[0].open();
}

export function applyLogLevel(commander: CommanderStatic) {
    const ll = (commander.logLevel || "").toUpperCase();
    if (ll in LogLevel) {
        Logger.logLevel = LogLevel[ll as string];
    }
}