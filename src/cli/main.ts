import * as readline from "readline";
import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { DeviceEnumerator } from "../devices/deviceEnumerator";
import * as Commands from "./commands";

async function handleCommand(commandArgs: string[]) {
    const commandName = commandArgs.shift();
    const command = Commands.resolveCommand(commandName);

    if (!command) {
        console.error(`Unrecognised command '${commandName}'`);
        return;
    }

    if (typeof command.minArgs !== "undefined" && commandArgs.length < command.minArgs) {
        console.error(`${commandName} expects at least ${command.minArgs} args`);
        return;
    }

    if (typeof command.maxArgs !== "undefined" && commandArgs.length > command.maxArgs) {
        console.error(`${commandName} expects at most ${command.maxArgs} args`);
        return;
    }

    try {
        const result = await command(commandArgs);
        if (result) console.log("OK");
    }
    catch(ex) {
        console.error(ex);
    }
}

async function main() {
    let devices = await DeviceEnumerator.listDevices();
    if (devices.length == 0) {
        console.error("No deviced detected, exiting...");
        return;
    }

    console.log(`Using ${devices[0].commandStation}`);
    let cs = await devices[0].open();
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

        const words = line.trim().split(" ").filter((s) => !!s);
        if (words.length == 0 || !words[0]) return;
        await handleCommand(words);

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
