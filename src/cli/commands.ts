import { Logger, LogLevel } from "../utils/logger";
import { timeout } from "../utils/promiseUtils";
import { ICommandStation } from "../devices/commandStations/commandStation";

type CommandFunc = (command:string[])=>Promise<boolean>;
export interface Command extends CommandFunc {
    notCommand?: boolean;
    minArgs?: number;
    maxArgs?: number;
    help?: () => string | string;
}

let _commandStation: ICommandStation = null;
const _seenLocos = new Set<number>();

function resolveLocoAddress(locoId: string): number {
    let address = parseInt(locoId);
    if (isNaN(address)) return -1;
    if (address < 1 || address > 9999) return -1;
    return address;
}

function resolveSpeed(speedStr: string): number {
    try {
        let speed = parseInt(speedStr);
        if (isNaN(speed)) return -1;
        if (speed < 0 || speed > 127) return -1;
        return speed;
    }
    catch {
        return -1;
    }
}

export function resolveCommand(commandName: string): Command {
    commandName = commandName.toLowerCase();
    if (!(commandName in exports))  return null;
    const command = exports[commandName] as Command;
    if (!(command instanceof Function)) return null;
    if (command.notCommand) return null;

    return command;
}
resolveCommand.notCommand = true;

export function setCommandStation(commandStation: ICommandStation) {
    _commandStation = commandStation;
}
setCommandStation.notCommand = true;

export async function estop(args: string[]) {
    if (_seenLocos.size == 0) {
        console.error("No locos have received commands yet.");
        return false;

    }
    const batch = await _commandStation.beginCommandBatch();
    for (const address of _seenLocos) {
        batch.setLocomotiveSpeed(address, 0);
    }
    await batch.commit();
    return true;
}
estop.help = "Emergency stop all locos which have received commands this session."

export async function exit(args: string[]) {
    process.exit(0);
}
exit.maxArgs = 0;
exit.help = "Exits this application";

export async function help(args: string[]) {
    if (args.length == 0) {
        console.log("Available commands:");
        for (const commandName of Object.keys(exports)) {
            if (!resolveCommand(commandName)) continue;
            console.log(`  ${commandName}`);
        }
        return true;
    }

    const command = resolveCommand(args[0]);
    if (!command) {
        console.error(`Unrecognised command '${args[0]}'`);
        return false;
    }
    if (!command.help) {
        console.error(`${args[0]} is not helpful`);
        return false;
    }
    const help = command.help instanceof Function ? command.help() : command.help;
    console.log(help);
    return true;
}
help.maxArgs = 1;
help.help = "Lists available commands or retrieves help on a command\n  Usage: help [COMMAND_NAME]";

export async function loco_speed(args: string[]) {
    let address = resolveLocoAddress(args[0]);
    let speed = resolveSpeed(args[1]);
    let reverse = args[2] == "R" || args[2] == "r";

    if (address < 0) {
        console.error(`'${args[0]}' is not a valid loco id`);
        return false;
    }

    if (speed < 0) {
        console.error(`'${args[1]}' is not a valid speed value`);
        return false;
    }

    _seenLocos.add(address);
    const batch = await _commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(address, speed, reverse);
    await batch.commit();

    return true;
}
loco_speed.minArgs = 2;
loco_speed.maxArgs = 3;
loco_speed.help = "Set locomotive's speed.\n  Usage: loco_speed LOCO_ID SPEED [F|R]";

export async function loglevel(args: string[]) {
    if (args.length == 0) {
        console.log(LogLevel[Logger.logLevel]);
        return true;
    }

    const newLevel = args[0].toUpperCase();
    if (!(newLevel in LogLevel)) {
        console.error(`${newLevel} isn't a recognised log level`);
        return false;
    }

    Logger.logLevel = LogLevel[newLevel];
    return true;
}
loglevel.minArgs = 0;
loglevel.maxArgs = 1;
loglevel.help = "Sets the application log level.\n  Usage: loglevel [NONE|ERROR|WARNING|DISPLAY|INFO|DEBUG]";

export async function sleep(args: string[]) {
    const time = parseFloat(args[0]);
    if (isNaN(time)) {
        console.error(`'${time}' is not a valid sleep duration`);
        return false;
    }

    await timeout(time);
    return true;
}
sleep.minArgs = 1;
sleep.minArgs = 1;
sleep.help = "Pause the CLI for the specified number of seconds.\n  Usage: sleep SECONDS";