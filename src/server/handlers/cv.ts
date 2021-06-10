import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok, ConnectionContext } from "./handlers"
import { RequestType, LocoCvReadRequest, LocoCvWriteRequest, CvValuePair } from "../../common/messages";
import { application } from "../../application";
import { ensureCvNumber, ensureByte } from "../../devices/commandStations/nmraUtils";
import { Permissions } from "../sessionmanager";

const log = new Logger("CV");

const RETRY_LIMIT = 3;

async function retryWrapper<T = void>(action: () => Promise<T>): Promise<T> {
    let count = 0;
    while (true) {
        try {
            return await action();
        }
        catch (err) {
            log.error(err.stack);
            if (count++ === RETRY_LIMIT) throw err;
            log.info("Retrying...");
        }
    }
}

async function onLocoCvReadMessage(context: ConnectionContext, request: LocoCvReadRequest, send: Sender): Promise<void> {
    await context.requirePermission(Permissions.TRAIN_EDIT);
    if (!request.cvs || request.cvs.length === 0) throw new Error("No CVs provided");
    for (const cv of request.cvs)
        ensureCvNumber(cv);

    for (const cv of request.cvs) {
        log.info(() => `Reading CV ${cv}...`);
        const value = await retryWrapper(() => application.commandStation.readLocoCv(cv));
        log.info(() => `CV ${cv} = ${value}`);
        const sent = await send({
            lastMessage: false,
            data: {
                cv: cv,
                value: value
            } as CvValuePair
        });

        // As reading CVs is quite a slow process and occupies the command station, we want to stop if
        // we discover that no one is listening to the results.
        if (!sent) return;
    }

    log.info("CV read batch complete");
    await ok(send);
}

async function onLocoCvWriteMessage(context: ConnectionContext, request: LocoCvWriteRequest, send: Sender): Promise<void> {
    await context.requirePermission(Permissions.TRAIN_EDIT);
    if (!request.cvs || request.cvs.length === 0) throw new Error("No CVs provided");
    // We want to do this first so that we don't attempt to write if the batch is invalid
    for (const pair of request.cvs) {
        ensureCvNumber(pair.cv);
        ensureByte(pair.value);
    }

    for (const pair of request.cvs) {
        log.info(() => `Writing CV ${pair.cv}...`);
        await retryWrapper(() => application.commandStation.writeLocoCv(pair.cv, pair.value));
        await send({
            lastMessage: false,
            data: pair
        });

        // Even if the web socket becomes disconnected, we want to continue writing CVs
        // as it could leave the loco in an invalid state if we stop halfway through
    }

    log.info("CV write batch complete");
    await ok(send);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoCvRead, onLocoCvReadMessage);
    map.set(RequestType.LocoCvWrite, onLocoCvWriteMessage);
}