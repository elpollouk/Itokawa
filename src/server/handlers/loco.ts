import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok, clientBroadcast } from "./handlers"
import { application } from "../../application";
import { RequestType, LocoSpeedRequest } from "../../common/messages";

const log = new Logger("LocoHandler");
const _seenLocos = new Set<number>();

async function broadcastSpeedChange(locoId: number, speed: number, reverse: boolean) {
    await clientBroadcast<LocoSpeedRequest>(RequestType.LocoSpeed, {
        locoId: locoId,
        speed: speed,
        reverse: reverse
    });
}

async function onLocoSpeed(request: LocoSpeedRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
    await batch.commit();

    _seenLocos.add(request.locoId);

    await ok(send);
    await broadcastSpeedChange(request.locoId, request.speed, request.reverse);
};

async function onEmergencyStop(data: any, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    const batch = await application.commandStation.beginCommandBatch();
    for (const locoId of _seenLocos) {
        log.debug(() => `Stopping loco ${locoId}`);
        batch.setLocomotiveSpeed(locoId, 0);
    }
    await batch.commit();

    await ok(send);

    for (const locoId of _seenLocos)
        await broadcastSpeedChange(locoId, 0, false);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoSpeed, onLocoSpeed);
    map.set(RequestType.EmergencyStop, onEmergencyStop);
}