import * as readline from "readline";
import * as program from "commander";
import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { addCommonOptions } from "../utils/commandLineArgs";
import { nextTick } from "../utils/promiseUtils";
import { toHumanHex } from "../utils/hex";
import { application } from "../application";
import * as executor from "./executor";

// All commands are implemented as module level function exports and we discover then via "reflection"
import * as Commands from "./commands";

addCommonOptions(program);
program
    .option("--exit-estop", "Issue eStop on exit")
    .option("--cmd <command>", "Execute a command")
    .option("-x --exec <script", "Execute a script")
    .option("--continue", "Continue to CLI after executing script or command");

// Helper function for displaying command output to the user
function _out(message: string) {
    console.log(message);
}

// Helper function to throw a user error of the correct type
function _error(message: string) {
    console.error(message);
}

// Handler for clean up when exit command is issued
async function _onExit() {
    try {
        if (program.exitEstop) await Commands.estop({
            out: _out,
            error: _error
        });
    }
    catch(ex) {
        if (!(ex instanceof executor.CommandError)) {
            console.error(ex.stack);
        }
    } 
}

async function main() {
    program.parse(process.argv);
    executor.registerCommands(Commands);

    application.onshutdown = _onExit;
    await application.start(program);
    if (!application.commandStation) {
        console.error("No command station connected");
        process.exit(1);
    }

    console.log(`Using ${application.commandStation.deviceId} ${application.commandStation.version}`);
    // Dump data received in raw mode
    application.commandStation.on("data", (data: Buffer | number[]) => {
        console.log(`data: ${toHumanHex(data)}`);
    });

    // Set up the global context for command execution
    const commandContext: executor.CommandContext = {
        out: _out,
        error: _error
    };

    // A command or script has been explicitly specified on the command line, so execute it and then exit
    if (program.cmd) {
        await executor.execCommandSafe(commandContext, program.cmd, true);
        if (!program.continue) await Commands.exit(commandContext);
    }
    else if (program.exec) {
        await executor.execCommandSafe(commandContext, `exec ${program.exec}`, true);
        if (!program.continue) await Commands.exit(commandContext);
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
            await executor.execCommandSafe(commandContext, line);
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
