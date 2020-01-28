import * as readline from "readline";
import * as program from "commander";
import { Logger, LogLevel } from "../utils/logger";
import { addCommonOptions, applyLogLevel, openDevice } from "../utils/commandLineArgs";
Logger.logLevel = LogLevel.DISPLAY;

// All commands are implemented as module level function exports and we discover then via "reflection"
import * as Commands from "./commands";

addCommonOptions(program);

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

// Helper function to throw a user error of the correct type
export function error(message: string) {
    throw new CommandError(message);
}

// Handler for a raw command string.
export async function execCommand(commandString: string) {
    try {
        const commandArgs = commandString.trim().split(" ").filter((s) => !!s);
        if (commandArgs.length == 0 || !commandArgs[0]) return;

        const commandName = commandArgs.shift();
        const command = resolveCommand(commandName);

        if (typeof command.minArgs !== "undefined" && commandArgs.length < command.minArgs) error(`${commandName} expects at least ${command.minArgs} args`);
        if (typeof command.maxArgs !== "undefined" && commandArgs.length > command.maxArgs) error(`${commandName} expects at most ${command.maxArgs} args`);

        await command(commandArgs);
        console.log("OK");
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

    let cs = await openDevice(program);
    if (!cs) {
        console.error("No deviced detected, exiting...");
        process.exit(1);
    }
    console.log(`Using ${cs.deviceId} ${cs.version}`);
    Commands.setCommandStation(cs);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "dcc> "
    });

    // Commands can execute asynchronouosly, so we need to reject user requets while execution is in progress
    let busy = false;
    rl.prompt();

    rl.on("line", async (line) => {

        if (busy) return;
        busy = true;

        await execCommand(line);

        rl.prompt();
        busy = false;

    }).on("close", () => {
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("*** UNHANDLED EXCEPTION ***")
    console.error(err.stack);
    process.exit(1);
});
