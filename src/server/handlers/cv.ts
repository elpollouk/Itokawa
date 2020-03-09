import { HandlerMap, Sender, ok } from "./handlers"
import { RequestType, LocoCvReadRequest, LocoCvWriteRequest } from "../../common/messages";
import { application } from "../../application";

const RETRY_LIMIT = 3;

async function retryWrapper(action: () => Promise<void>) {
    let count = 0;
    while (true) {
        try {
            await action();
            break;
        }
        catch (err) {
            if (count++ === RETRY_LIMIT) throw err;
        }
    }
}

async function onLocoCvReadMessage(request: LocoCvReadRequest, send: Sender): Promise<void> {
    if (!request.cvs || request.cvs.length === 0) throw new Error("No CVs provided");

    for (const cv of request.cvs) {
        await retryWrapper(async () => {
            const value = await application.commandStation.readLocoCv(cv);
            await send({
                lastMessage: false,
                data: value
            });
        });
    }
    await ok(send);
}

async function onLocoCvWriteMessage(request: LocoCvWriteRequest, send: Sender): Promise<void> {
    if (!request.cvs || request.cvs.length === 0) throw new Error("No CVs provided");

    for (const pair of request.cvs) {
        await retryWrapper(async () => {
            await application.commandStation.writeLocoCv(pair.cv, pair.value);
            await send({
                lastMessage: false,
                data: pair.cv
            });
        });
    }
    await ok(send);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoCvRead, onLocoCvReadMessage);
    map.set(RequestType.LocoCvWrite, onLocoCvWriteMessage);
}