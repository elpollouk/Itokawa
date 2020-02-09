import { Logger, LogLevel } from "../utils/logger";

import { application } from "../application";
import { spawnAsync } from "../utils/exec";
import { execRestart } from "./shutdown";
import * as messages from "../common/messages";

const log = new Logger("Updater");

const UPDATE_COMMAND =  "npm run prod-update";

let _updateInProgress = false;

export async function updateApplication(send: (message: messages.CommandResponse)=>Promise<void>) {
    if (_updateInProgress) throw new Error("An update is already in progress");
    _updateInProgress = true;

    try {
        const command = application.config.getAs<string>("server.commands.update", UPDATE_COMMAND);
        const exitCode = await spawnAsync(command, (out: string) => {
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

        setTimeout(() => {
            _updateInProgress = false;
            execRestart().catch((err: Error) => {
                log.error(`Failed to execute restart: ${err.message}`);
                log.error(err.stack);
            });
        })
    }
    catch (ex) {
        log.error("Update failed");
        log.error(ex.stack);
        _updateInProgress = false;
        throw ex;
    }
}