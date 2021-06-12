import * as commander from "commander";
import { Logger, LogLevel } from "./logger";
let pjson = require('../../package.json');

export function addCommonOptions(program: commander.Command) {
    program
        .version(pjson.version)
        .option("-d --device <device>", "Device type to open")
        .option("-c --connection-string <connectionString>", "Connection configuration string")
        .option("--log-level <loglevel>", "Log level")
        .option("--features <feature flags>", "Pre-release feature flags")
        .option("--profile <profile>", "Config override profile");
}

export function applyLogLevel(options: commander.OptionValues) {
    const ll = (options.logLevel || "").toUpperCase();
    if (ll in LogLevel) {
        Logger.logLevel = LogLevel[ll as string];
    }
}