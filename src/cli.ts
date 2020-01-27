import * as readline from "readline";
import { Logger, LogLevel } from "./utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { DeviceEnumerator } from "./devices/deviceEnumerator";


const commands = new Map<string, (command:string[])=>Promise<boolean>>([
    ["exit", async () => process.exit(0)],

    ["loglevel", async (command:string[]) => {
        if (command.length < 2) {
            console.log(LogLevel[Logger.logLevel]);
            return true;
        }
        else if (command.length > 2) {
            console.error("Wrong number of arguments");
            return true;
        }
        const newLevel = command[1].toUpperCase();
        if (!(newLevel in LogLevel)) {
            console.error(`${newLevel} isn't a recognised log level`);
            return false;
        }
    
        Logger.logLevel = LogLevel[newLevel];
        return true;
    }],


]);


async function main() {
    let devices = await DeviceEnumerator.listDevices();
    if (devices.length == 0) {
        console.error("No deviced detected, exiting...");
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "dcc> "
    });

    rl.prompt();

    rl.on("line", async (line) => {
        const words = line.trim().split(" ");
        
        if (commands.has(words[0])) {
            try {
                const result = await commands.get(words[0])(words);
                if (result) console.log("OK");
            }
            catch(ex) {
                console.error(ex);
            }
        }
        else if (words.length !== 0 && words[0]) {
            console.log(`Unrecognised command '${words[0]}'`);
        }

        rl.prompt();
    }).on("close", () => {
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("*** UNHANDLED EXCEPTION ***")
    console.error(err.stack);
    process.exit(1);
});
