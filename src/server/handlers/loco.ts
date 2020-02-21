import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok, clientBroadcast } from "./handlers"
import { application } from "../../application";
import { RequestType, LocoSpeedRequest } from "../../common/messages";

const log = new Logger("LocoHandler");

interface LocoSetting {
    speed: number,
    reverse: boolean
}

const _seenLocos = new Map<number, LocoSetting>();

function setLocoDetails(locoId: number, speed: number, reverse: boolean) {
    _seenLocos.set(locoId, {
        speed: speed,
        reverse: reverse
    });
}

async function broadcastSpeedChange(locoId: number, speed: number, reverse: boolean) {
    setLocoDetails(locoId, speed, reverse);
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

    await ok(send);
    await broadcastSpeedChange(request.locoId, request.speed, request.reverse);
};

async function onEmergencyStop(data: any, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    const batch = await application.commandStation.beginCommandBatch();
    for (const locoId of _seenLocos.keys()) {
        log.debug(() => `Stopping loco ${locoId}`);
        batch.setLocomotiveSpeed(locoId, 0);
    }
    await batch.commit();

    await ok(send);

    for (const locoId of _seenLocos.keys())
        await broadcastSpeedChange(locoId, 0, false);
}

async function onLocoSpeedRefresh(data: any, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");

    for (const locoId of _seenLocos.keys()) {
        const detals = _seenLocos.get(locoId);
        await send({
            lastMessage: false,
            data: {
                locoId: locoId,
                speed: detals.speed,
                reverse: detals.reverse
            } as LocoSpeedRequest
        });
    }

    await ok(send);
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoSpeed, onLocoSpeed);
    map.set(RequestType.EmergencyStop, onEmergencyStop);
    map.set(RequestType.LocoSpeedRefresh, onLocoSpeedRefresh);
}