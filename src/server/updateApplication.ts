import { Logger, LogLevel } from "../utils/logger";

import { spawnAsync } from "../utils/exec";
import { execRestart } from "./shutdown";
import * as messages from "../common/messages";

const log = new Logger("Updater");

export async function updateApplication(send: (message: messages.CommandResponse)=>Promise<void>) {
    const exitCode = await spawnAsync("npm run update", (out: string) => {
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
        data: "Scheduling restart in 3 seconds..."
    });

    setTimeout(() => {
        execRestart().catch((err: Error) => {
            log.error(`Failed to execute restart: ${err.message}`);
            log.error(err.stack);
        });
    })
}