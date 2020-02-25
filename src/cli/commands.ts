import { Logger, LogLevel } from "../utils/logger";
import { resolveCommand, execCommand, CommandContext } from "./main"
import { timeout } from "../utils/promiseUtils";
import * as fs from "fs";
import { fromHex } from "../utils/hex";
import { application } from "../application";

// Maintain a list of locos we've sent commands to for the 'estop' command
const _seenLocos = new Set<number>();

function resolveLocoAddress(context: CommandContext, locoId: string): number {
    let address = parseInt(locoId);
    if (isNaN(address)) context.error(`'${locoId}' is not a valid loco id`);
    if (address < 1 || address > 9999) context.error(`'${locoId}' is not a valid loco id`)

    _seenLocos.add(address);

    return address;
}

function resolveSpeed(context: CommandContext, speedStr: string): number {
    let speed = parseInt(speedStr);
    if (isNaN(speed)) context.error(`'${speedStr}' is not a valid speed value`);
    if (speed < 0 || speed > 127) context.error(`'${speedStr}' is not a valid speed value`);
    return speed;
}


//-----------------------------------------------------------------------------------------------//
// Exported commands
// Please keep them in alphabetical order
//-----------------------------------------------------------------------------------------------//

// Echo
export async function echo(context: CommandContext, args: string[]) {
    const message = args.join(" ");
    context.out(message);
}
echo.minArgs = 1;
echo.help = "Echo args back to the output."

// Emergency stop
export async function estop(context: CommandContext, args?: string[]) {
    if (_seenLocos.size == 0) context.error("No locos have received commands yet.");

    const batch = await application.commandStation.beginCommandBatch();
    for (const address of _seenLocos) {
        batch.setLocomotiveSpeed(address, 0);
    }
    await batch.commit();
}
estop.help = "Emergency stop all locos which have received commands this session."

// Execute a script
export function exec(context: CommandContext, args: string[]) {
    return new Promise<void>(async (resolve, reject) => {
        fs.readFile(args[0], async (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const script = data.toString().split("\n");
            for (const line of script)
               await execCommand(context, line, true);

            resolve();
        });
    });
}
exec.minArgs = 1;
exec.maxArgs = 1;
exec.help = "Execute a script.\n  Usage: exec SCRIPT_PATH"

// Exit
export async function exit(context: CommandContext, args?: string[]) {
    await application.shutdown();
}
exit.maxArgs = 0;
exit.help = "Exits this application";

// Help
export async function help(context: CommandContext, args: string[]) {
    if (args.length == 0) {
        context.out("Available commands:");
        for (const commandName of Object.keys(exports)) {
            try {
                resolveCommand(context, commandName);
                context.out(`  ${commandName}`);
            }
            catch {}
        }
        return;
    }

    const command = resolveCommand(context, args[0]);
    if (!command) context.error(`Unrecognised command '${args[0]}'`);
    if (!command.help) context.error(`${args[0]} is not helpful`);

    const help = command.help instanceof Function ? command.help() : command.help;
    context.out(help);
}
help.maxArgs = 1;
help.help = "Lists available commands or retrieves help on a command\n  Usage: help [COMMAND_NAME]";

// Loco Speed Control
export async function loco_speed(context: CommandContext, args: string[]) {
    let reverse = args[2] == "R" || args[2] == "r";
    let speed = resolveSpeed(context, args[1]);
    let address = resolveLocoAddress(context, args[0]);

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(address, speed, reverse);
    await batch.commit();
}
loco_speed.minArgs = 2;
loco_speed.maxArgs = 3;
loco_speed.help = "Set locomotive's speed.\n  Usage: loco_speed LOCO_ID SPEED [F|R]";

// Log level
export async function loglevel(context: CommandContext, args: string[]) {
    if (args.length == 0) {
        context.out(LogLevel[Logger.logLevel]);
        return;
    }

    const newLevel = args[0].toUpperCase();
    if (!(newLevel in LogLevel)) context.error(`${newLevel} isn't a recognised log level`);

    Logger.logLevel = LogLevel[newLevel];
}
loglevel.minArgs = 0;
loglevel.maxArgs = 1;
loglevel.help = "Sets the application log level.\n  Usage: loglevel [NONE|ERROR|WARNING|DISPLAY|INFO|DEBUG]";

// Write raw data as part of a command batch
export async function raw_command(context: CommandContext, args: string[]) {
    const hex = args.join("");
    const data = fromHex(hex);
    const batch = await application.commandStation.beginCommandBatch();
    batch.writeRaw(data);
    await batch.commit();
}
raw_command.minArgs = 1;
raw_command.help = "Write raw bytes as a command batch\n  Udate: raw_command HEX_DATA";

// Write raw data directly to the command station
export async function raw_write(context: CommandContext, args: string[]) {
    const hex = args.join("");
    const data = fromHex(hex);
    await application.commandStation.writeRaw(data);
}
raw_write.minArgs = 1;
raw_write.help = "Write raw bytes to the command station\n  Udate: raw_write HEX_DATA";

// Sleep
export async function sleep(context: CommandContext, args: string[]) {
    const time = parseFloat(args[0]);
    if (isNaN(time)) context.error(`'${time}' is not a valid sleep duration`);

    await timeout(time);
}
sleep.minArgs = 1;
sleep.minArgs = 1;
sleep.help = "Pause the CLI for the specified number of seconds.\n  Usage: sleep SECONDS";