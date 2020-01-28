import { Logger, LogLevel } from "../utils/logger";
import { timeout } from "../utils/promiseUtils";
import { ICommandStation } from "../devices/commandStations/commandStation";

type CommandFunc = (command:string[])=>Promise<void>;
export interface Command extends CommandFunc {
    notCommand?: boolean;
    minArgs?: number;
    maxArgs?: number;
    help?: () => string | string;
}

let _commandStation: ICommandStation = null;
const _seenLocos = new Set<number>();

export function error(message: string) {
    throw new CommandError(message);
}
error.notCommand = true;

function resolveLocoAddress(locoId: string): number {
    let address = parseInt(locoId);
    if (isNaN(address)) error(`'${locoId}' is not a valid loco id`);
    if (address < 1 || address > 9999) error(`'${locoId}' is not a valid loco id`)

    _seenLocos.add(address);

    return address;
}

function resolveSpeed(speedStr: string): number {
    let speed = parseInt(speedStr);
    if (isNaN(speed)) `'${speedStr}' is not a valid speed value`
    if (speed < 0 || speed > 127) `'${speedStr}' is not a valid speed value`
    return speed;
}

export class CommandError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function resolveCommand(commandName: string): Command {
    commandName = commandName.toLowerCase();
    if (!(commandName in exports)) error(`Unrecognised command '${commandName}'`);
    const command = exports[commandName] as Command;
    if (!(command instanceof Function)) error(`Unrecognised command '${commandName}'`);
    if (command.notCommand) error(`Unrecognised command '${commandName}'`);

    return command;
}
resolveCommand.notCommand = true;

export function setCommandStation(commandStation: ICommandStation) {
    _commandStation = commandStation;
}
setCommandStation.notCommand = true;

export async function estop(args: string[]) {
    if (_seenLocos.size == 0) error("No locos have received commands yet.");

    const batch = await _commandStation.beginCommandBatch();
    for (const address of _seenLocos) {
        batch.setLocomotiveSpeed(address, 0);
    }
    await batch.commit();
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
            try {
                resolveCommand(commandName);
                console.log(`  ${commandName}`);
            }
            catch {}
        }
        return;
    }

    const command = resolveCommand(args[0]);
    if (!command) error(`Unrecognised command '${args[0]}'`);
    if (!command.help) error(`${args[0]} is not helpful`);

    const help = command.help instanceof Function ? command.help() : command.help;
    console.log(help);
}
help.maxArgs = 1;
help.help = "Lists available commands or retrieves help on a command\n  Usage: help [COMMAND_NAME]";

export async function loco_speed(args: string[]) {
    let reverse = args[2] == "R" || args[2] == "r";
    let speed = resolveSpeed(args[1]);
    let address = resolveLocoAddress(args[0]);

    const batch = await _commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(address, speed, reverse);
    await batch.commit();
}
loco_speed.minArgs = 2;
loco_speed.maxArgs = 3;
loco_speed.help = "Set locomotive's speed.\n  Usage: loco_speed LOCO_ID SPEED [F|R]";

export async function loglevel(args: string[]) {
    if (args.length == 0) {
        console.log(LogLevel[Logger.logLevel]);
        return;
    }

    const newLevel = args[0].toUpperCase();
    if (!(newLevel in LogLevel)) error(`${newLevel} isn't a recognised log level`);

    Logger.logLevel = LogLevel[newLevel];
}
loglevel.minArgs = 0;
loglevel.maxArgs = 1;
loglevel.help = "Sets the application log level.\n  Usage: loglevel [NONE|ERROR|WARNING|DISPLAY|INFO|DEBUG]";

export async function sleep(args: string[]) {
    const time = parseFloat(args[0]);
    if (isNaN(time)) error(`'${time}' is not a valid sleep duration`);

    await timeout(time);
}
sleep.minArgs = 1;
sleep.minArgs = 1;
sleep.help = "Pause the CLI for the specified number of seconds.\n  Usage: sleep SECONDS";