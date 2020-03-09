import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok } from "./handlers"
import { RequestType, LocoCvReadRequest, LocoCvWriteRequest } from "../../common/messages";
import { application } from "../../application";
import { ensureCvNumber, ensureByte } from "../../devices/commandStations/nmraUtils";

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

async function onLocoCvReadMessage(request: LocoCvReadRequest, send: Sender): Promise<void> {
    if (!request.cvs || request.cvs.length === 0) throw new Error("No CVs provided");
    for (const cv of request.cvs)
        ensureCvNumber(cv);

    for (const cv of request.cvs) {
        log.info(() => `Reading CV ${cv}...`);
        const value = await retryWrapper(() => application.commandStation.readLocoCv(cv));
        log.info(() => `CV ${cv} = ${value}`);
        await send({
            lastMessage: false,
            data: value
        });
    }

    log.info("CV read batch complete");
    await ok(send);
}

async function onLocoCvWriteMessage(request: LocoCvWriteRequest, send: Sender): Promise<void> {
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
            data: pair.cv
        });
    }

    log.info("CV write batch complete");
    await ok(send);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoCvRead, onLocoCvReadMessage);
    map.set(RequestType.LocoCvWrite, onLocoCvWriteMessage);
}