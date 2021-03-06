import { Logger, LogLevel } from "../utils/logger";

import { application } from "../application";
import { spawnAsync } from "../utils/exec";
import * as messages from "../common/messages";

const log = new Logger("Updater");

const UPDATE_COMMAND =  "npm run prod-update";
const UPDATE_OS_COMMAND = "sudo apt-get update && sudo apt-get -y dist-upgrade"

// Hooks to allow for testing so that tests that use global functions can overlap
export let _spawnAsync = spawnAsync;

async function _runUpdate(command: string, operationId: string, send: (message: messages.CommandResponse)=>Promise<boolean>) {
    const endOperation = application.lifeCycle.beginSensitiveOperation(operationId);

    try {
        const exitCode = await _spawnAsync(command, (out: string) => {
            send({
                lastMessage: false,
                data: out
            });
        }, (err: string) => {
            send({
                lastMessage: false,
                error: err
            });
        });
        if (exitCode !== 0) throw new Error(`Update failed, process exited with code ${exitCode}`);
        await send({
            lastMessage: true,
            data: "\nUpdate complete!"
        });
    }
    catch (ex) {
        log.error("Update failed");
        log.error(ex.stack);
        throw ex;
    }
    finally {
        endOperation();
    }
}

export async function updateApplication(send: (message: messages.CommandResponse)=>Promise<boolean>) {
    const command = application.config.getAs<string>("server.commands.update", UPDATE_COMMAND);
    await _runUpdate(command, "updateApplication", send);
}

export async function updateOS(send: (message: messages.CommandResponse)=>Promise<boolean>) {
    let command = application.config.getAs<string>("server.commands.updateOS");
    if (!command && process.platform != "linux") throw new Error(`OS update not configured for ${process.platform}`);
    command = command ?? UPDATE_OS_COMMAND;

    await _runUpdate(command, "updateOS", send);
}
