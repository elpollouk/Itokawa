import { Logger, LogLevel } from "../utils/logger";

import { application } from "../application";
import { spawnAsync } from "../utils/exec";
import * as messages from "../common/messages";

const log = new Logger("Updater");

const UPDATE_COMMAND =  "npm run prod-update";

let _updateInProgress = false;

// Hooks to allow for testing so that tests that use global functions can overlap
export let _spawnAsync = spawnAsync;
export let _setTimeout = setTimeout;

export async function updateApplication(send: (message: messages.CommandResponse)=>Promise<boolean>) {
    if (_updateInProgress) throw new Error("An update is already in progress");
    _updateInProgress = true;

    try {
        const command = application.config.getAs<string>("server.commands.update", UPDATE_COMMAND);
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
            data: "\nScheduling restart in 3 seconds..."
        });

        _setTimeout(() => {
            _updateInProgress = false;
            return application.restart().catch((err: Error) => {
                log.error(`Failed to execute restart: ${err.message}`);
                log.error(err.stack);
            });
        }, 3000);
    }
    catch (ex) {
        log.error("Update failed");
        log.error(ex.stack);
        _updateInProgress = false;
        throw ex;
    }
}