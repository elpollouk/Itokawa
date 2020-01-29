import * as readline from "readline";
import * as program from "commander";
import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { addCommonOptions, applyLogLevel, openDevice } from "../utils/commandLineArgs";

// All commands are implemented as module level function exports and we discover then via "reflection"
import * as Commands from "./commands";
import { ICommandStation } from "../devices/commandStations/commandStation";
import { nextTick } from "../utils/promiseUtils";
import { parseCommand } from "../utils/parsers";
import { toHumanHex } from "../utils/hex";

addCommonOptions(program);
program
    .option("--exit-estop", "Issue eStop on exit")
    .option("--cmd <command>", "Execute a command")
    .option("-x --exec <script", "Execute a script")
    .option("--continue", "Continue to CLI after executing script or command");

// Command function interface that specifies the available attributes
type CommandFunc = (command:string[])=>Promise<void>;
export interface Command extends CommandFunc {
    notCommand?: boolean;           // Flag that the exported function is not a user command
    minArgs?: number;               // Minimum number of args the user must supply
    maxArgs?: number;               // Maximum number of args the user can supply
    help?: () => string | string;   // String to display for command help
}

// An exception a command can throw to display an error to the user without a call stack.
// Should be used for user caused errors such as incorrectly specified args rather than actual failures.
export class CommandError extends Error {
    constructor(message: string) {
        super(message);
    }
}

let _commandStation: ICommandStation = null;

// Helper function to throw a user error of the correct type
export function error(message: string) {
    throw new CommandError(message);
}

// Handler for clean up when exit command is issued
async function onExit() {
    try {
        if (program.exitEstop) await Commands.estop();
    }
    catch(ex) {
        if (!(ex instanceof CommandError)) throw ex;
    } 
    await _commandStation.close();
}

// Handler for a raw command string.
export async function execCommand(commandString: string, suppressOk: boolean=false) {
    try {
        const commandArgs = parseCommand(commandString);
        if (commandArgs.length == 0) return;

        const commandName = commandArgs.shift();
        const command = resolveCommand(commandName);

        if (typeof command.minArgs !== "undefined" && commandArgs.length < command.minArgs) error(`${commandName} expects at least ${command.minArgs} args`);
        if (typeof command.maxArgs !== "undefined" && commandArgs.length > command.maxArgs) error(`${commandName} expects at most ${command.maxArgs} args`);

        await command(commandArgs);
        if (!suppressOk) console.log("OK");
    }
    catch(ex) {
        if (ex instanceof CommandError) console.error(ex.message);
        else console.error(ex);
    }
}

// Return the function for the specified command.
// If the command isn't found int the Commands exports or isn't a valid command function, an exception is raised
export function resolveCommand(commandName: string): Command {
    commandName = commandName.toLowerCase();
    const command = Commands[commandName] as Command;
    if (!(command instanceof Function)) error(`Unrecognised command '${commandName}'`);
    if (command.notCommand) error(`Unrecognised command '${commandName}'`);

    return command;
}

async function main() {
    program.parse(process.argv);
    applyLogLevel(program);

    _commandStation = await openDevice(program);
    if (!_commandStation) {
        console.error("No deviced detected, exiting...");
        process.exit(1);
    }

    console.log(`Using ${_commandStation.deviceId} ${_commandStation.version}`);
    // Dump data received in raw mode
    _commandStation.on("data", (data: Buffer | number[]) => {
        console.log(`data: ${toHumanHex(data)}`);
    });

    Commands.setCommandStation(_commandStation);
    Commands.setExitHook(onExit);

    // A command or script has been explicitly specified on the command line, so execute it and then exit
    if (program.cmd) {
        await execCommand(program.cmd, true);
        if (!program.continue) await Commands.exit();
    }
    else if (program.exec) {
        await Commands.exec([program.exec]);
        if (!program.continue) await Commands.exit();
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "dcc> "
    });

    // Commands can execute asynchronously, so we need to buffer user requets while execution is in progress
    let busy = false;
    let lineBuffer = [];
    async function  proccessBufferedLines() {
        if (busy) return;
        busy = true;

        while (lineBuffer.length) {
            const line = lineBuffer.shift();
            await execCommand(line);
            await nextTick(); // Make sure other events have an opportunity to run between commands
        }

        rl.prompt();
        busy = false;
    }

    rl.prompt();
    rl.on("line", (line) => {

        lineBuffer.push(line);
        proccessBufferedLines();

    }).on("close", () => {
        process.exit(0);
    });
}

main().catch((err) => {
    if (err.stack) console.error(err.stack);
    else console.error(err);
    process.exit(1);
});
