import { CommanderStatic } from "commander";
import { Logger, LogLevel } from "./logger";
let pjson = require('../../package.json');

export function addCommonOptions(commander: CommanderStatic) {
    commander
        .version(pjson.version)
        .option("-d --device <device>", "Device type to open.")
        .option("-c --connection-string <connectionString>", "Connection configuration string.")
        .option("--log-level <loglevel>", "Log level");
}

export function applyLogLevel(commander: CommanderStatic) {
    const ll = (commander.logLevel || "").toUpperCase();
    if (ll in LogLevel) {
        Logger.logLevel = LogLevel[ll as string];
    }
}