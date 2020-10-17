import { parseCommand } from "../utils/parsers";

// Command function interface that specifies the available attributes
type CommandFunc = (context: CommandContext, command:string[])=>Promise<void>;
export interface Command extends CommandFunc {
    notCommand?: boolean;           // Flag that the exported function is not a user command
    minArgs?: number;               // Minimum number of args the user must supply
    maxArgs?: number;               // Maximum number of args the user can supply
    help?: string;                  // String to display for command help
}

// Context used to allow commands to interact with their execution environment
type Output = (message:string)=>void;
export interface CommandContext {
    out: Output;
    error: Output;
    vars: {};
}

// An exception a command can throw to display an error to the user without a call stack.
// Should be used for user caused errors such as incorrectly specified args rather than actual failures.
export class CommandError extends Error {
    constructor(message: string) {
        super(message);
    }
}

// Utility function to raise command errors of the correct type
export function error(message: string) {
    throw new CommandError(message);
}

let _commands: {[ket:string]:Command} = null;

// Clear out all additionally registered commands
export function clearCommands() {
    _commands = {}
    _commands["help"] = help;
    _commands["set"] = set;
    _commands["unset"] = unset;
}

// Register commands with the executor
export function registerCommands(...commandModules: any[]) {
    for (const module of commandModules) {
        for (const entry in module) {
            const command = module[entry];
            if (!(command instanceof Function)) continue;
            if (command.notCommand) continue;
            _commands[entry] = command;
        }
    }
}

// Handler for a raw command string which captures errors.
export async function execCommandSafe(context: CommandContext, commandString: string, suppressOk: boolean=false) {
    try {
        await execCommand(context, commandString, suppressOk);
    }
    catch (ex) {
        context.error(ex.message);
    }
}

// Handler for a raw command string.
export async function execCommand(context: CommandContext, commandString: string, suppressOk: boolean=false) {
    const commandArgs = parseCommand(commandString);
    if (commandArgs.length == 0) return;

    const commandName = commandArgs.shift();
    const command = resolveCommand(context, commandName);

    if (typeof command.minArgs !== "undefined" && commandArgs.length < command.minArgs) error(`${commandName} expects at least ${command.minArgs} args`);
    if (typeof command.maxArgs !== "undefined" && commandArgs.length > command.maxArgs) error(`${commandName} expects at most ${command.maxArgs} args`);

    // Resolve variables
    for (let i = 0; i < commandArgs.length; i++) {
        if (commandArgs[i][0] !== '$') continue;
        const variable = commandArgs[i].substr(1);
        if (!variable) error("Variable not specified");
        if (!(variable in context.vars)) error(`Variable '${variable}' not set`);
        commandArgs[i] = context.vars[variable];
    }

    await command(context, commandArgs);
    if (!suppressOk) context.out("OK");
}

// Return the function for the specified command.
// If the command isn't found int the Commands exports or isn't a valid command function, an exception is raised
export function resolveCommand(context: CommandContext, commandName: string): Command {
    commandName = commandName.toLowerCase();
    const command = _commands[commandName] as Command;
    if (!command) error(`Unrecognised command '${commandName}'`);

    return command;
}


//-----------------------------------------------------------------------------------------------//
// Built in commands
//-----------------------------------------------------------------------------------------------//

// Help
async function help(context: CommandContext, args: string[]) {
    if (args.length == 0) {
        context.out("Available commands:");
        for (const commandName of Object.keys(_commands).sort()) {
            context.out(`  ${commandName}`);
        }
        return;
    }

    const command = resolveCommand(context, args[0]);
    if (!command.help) error(`${args[0]} is not helpful`);

    context.out(command.help);
}
help.maxArgs = 1;
help.help = "Lists available commands or retrieves help on a command\n  Usage: help [COMMAND_NAME]";

// Set script variable
async function set(context: CommandContext, args: string[]) {
    if (args.length === 0) {
        for (const key of Object.keys(context.vars).sort()) {
            context.out(`${key}=${context.vars[key]}`);
        }
        return;
    }

    if (args.length === 1) error(`No value provided for '${args[0]}'`);
    context.vars[args[0]] = args[1];
}
set.maxArgs = 2;
set.help = "Sets a script variable or lists all currently set variables\n  Usage: set [VARIABLE VALUE]";

// Clear a script variable
async function unset(context: CommandContext, args: string[]) {
    if (!(args[0] in context.vars)) error(`'${args[0]}' is not set`);
    delete context.vars[args[0]];
}
unset.minArgs = 1;
unset.maxArgs = 1;
unset.help = "Clear a script variable\n  Usage: set VARIABLE";

clearCommands();
