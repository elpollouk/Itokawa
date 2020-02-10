import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok } from "./handlers"
import { application } from "../../application";
import { CommandRequest, RequestType, LocoSpeedRequest } from "../../common/messages";

const log = new Logger("LocoHandler");
const _seenLocos = new Set<number>();

async function onLocoSpeed(msg: CommandRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    const request = msg as LocoSpeedRequest;
    if (request.type !== RequestType.LocoSpeed) throw new Error(`Invalid request type: ${request.type}`);

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
    await batch.commit();

    _seenLocos.add(request.locoId);

    await ok(send);
};

async function onEmergencyStop(msg: CommandRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    const batch = await application.commandStation.beginCommandBatch();
    for (const locoId of _seenLocos) {
        log.debug(() => `Stopping loco ${locoId}`);
        batch.setLocomotiveSpeed(locoId, 0);
    }
    await batch.commit();

    await ok(send);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoSpeed, onLocoSpeed);
    map.set(RequestType.EmergencyStop, onEmergencyStop);
}