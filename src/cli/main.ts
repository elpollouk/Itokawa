import * as readline from "readline";
import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { DeviceEnumerator } from "../devices/deviceEnumerator";
import * as Commands from "./commands";

type CommandFunc = (command:string[])=>Promise<void>;
export interface Command extends CommandFunc {
    notCommand?: boolean;
    minArgs?: number;
    maxArgs?: number;
    help?: () => string | string;
}

export class CommandError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function error(message: string) {
    throw new CommandError(message);
}

export async function handleCommand(commandString: string) {
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

export function resolveCommand(commandName: string): Command {
    commandName = commandName.toLowerCase();
    const command = Commands[commandName] as Command;
    if (!(command instanceof Function)) error(`Unrecognised command '${commandName}'`);
    if (command.notCommand) error(`Unrecognised command '${commandName}'`);

    return command;
}

async function main() {
    let devices = await DeviceEnumerator.listDevices();
    if (devices.length == 0) {
        console.error("No deviced detected, exiting...");
        return;
    }

    console.log(`Using ${devices[0].commandStation}`);
    let cs = await devices[0].open();
    
    //let cs = await DeviceEnumerator.openDevice("Null");
    Commands.setCommandStation(cs);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "dcc> "
    });

    let busy = false;
    rl.prompt();

    rl.on("line", async (line) => {

        if (busy) return;
        busy = true;

        await handleCommand(line);

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
