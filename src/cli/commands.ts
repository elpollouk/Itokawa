import { Logger, LogLevel } from "../utils/logger";
import { resolveCommand, error, execCommand } from "./main"
import { timeout } from "../utils/promiseUtils";
import { ICommandStation } from "../devices/commandStations/commandStation";
import * as fs from "fs";

let _exitHook: ()=>Promise<void> = null;
let _commandStation: ICommandStation = null;
// Maintain a list of locos we've sent commands to for the 'estop' command
const _seenLocos = new Set<number>();

function resolveLocoAddress(locoId: string): number {
    let address = parseInt(locoId);
    if (isNaN(address)) error(`'${locoId}' is not a valid loco id`);
    if (address < 1 || address > 9999) error(`'${locoId}' is not a valid loco id`)

    _seenLocos.add(address);

    return address;
}

function resolveSpeed(speedStr: string): number {
    let speed = parseInt(speedStr);
    if (isNaN(speed)) error(`'${speedStr}' is not a valid speed value`);
    if (speed < 0 || speed > 127) error(`'${speedStr}' is not a valid speed value`);
    return speed;
}

// Allow other modules to specify the command station that commands should operate on
export function setCommandStation(commandStation: ICommandStation) {
    _commandStation = commandStation;
}
setCommandStation.notCommand = true;

export function setExitHook(onExit: ()=>Promise<void>) {
    _exitHook = onExit;
}

//-----------------------------------------------------------------------------------------------//
// Exported commands
// Please keep them in alphabetical order
//-----------------------------------------------------------------------------------------------//

// Echo
export async function echo(args: string[]) {
    const message = args.join(" ");
    console.log(message);
}
echo.minArgs = 1;
echo.help = "Echo args back to the output."

// Emergency stop
export async function estop(args: string[]) {
    if (_seenLocos.size == 0) error("No locos have received commands yet.");

    const batch = await _commandStation.beginCommandBatch();
    for (const address of _seenLocos) {
        batch.setLocomotiveSpeed(address, 0);
    }
    await batch.commit();
}
estop.help = "Emergency stop all locos which have received commands this session."

// Execute a script
export async function exec(args: string[]) {
    return new Promise((resolve, reject) => {
        fs.readFile(args[0], async (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const script = data.toString().split("\n");
            for (const line of script)
               await execCommand(line, true);

            resolve();
        });
    });
}
exec.minArgs = 1;
exec.maxArgs = 1;
exec.help = "Execute a script.\n  Usage: exec SCRIPT_PATH"

// Exit
export async function exit(args?: string[]) {
    if (_exitHook) await _exitHook();
    process.exit(0);
}
exit.maxArgs = 0;
exit.help = "Exits this application";

// Help
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

// Loco Speed Control
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

// Log level
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

// Sleep
export async function sleep(args: string[]) {
    const time = parseFloat(args[0]);
    if (isNaN(time)) error(`'${time}' is not a valid sleep duration`);

    await timeout(time);
}
sleep.minArgs = 1;
sleep.minArgs = 1;
sleep.help = "Pause the CLI for the specified number of seconds.\n  Usage: sleep SECONDS";