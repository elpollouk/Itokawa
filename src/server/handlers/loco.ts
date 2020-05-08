import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok, clientBroadcast } from "./handlers"
import { application } from "../../application";
import { RequestType, LocoSpeedRequest, LocoFunctionRequest, FunctionAction } from "../../common/messages";
import * as CommandStation from "../../devices/commandStations/commandStation";

const log = new Logger("LocoHandler");

const NUM_FUNCTIONS = 29;

interface LocoSetting {
    speed: number,
    reverse: boolean,
    functions: boolean[]
}

const _seenLocos = new Map<number, LocoSetting>();

function createLoco(): LocoSetting {
    return {
        functions: new Array(NUM_FUNCTIONS).fill(false)
    } as LocoSetting;
}

function getLocoState(locoId: number) {
    let loco = _seenLocos.get(locoId);
    if (!loco) {
        loco = createLoco();
    }
    return loco;
}

function setLocoSpeedAndDirection(locoId: number, speed: number, reverse: boolean) {
    let loco = getLocoState(locoId);
    loco.speed = speed;
    loco.reverse = reverse
    _seenLocos.set(locoId, loco);
}

function setLocoFunction(locoId: number, func: number, state: boolean) {
    let loco = getLocoState(locoId);
    loco.functions[func] = state;
    _seenLocos.set(locoId, loco);
}

function isStatefullAction(action: FunctionAction) {
    switch (action) {
        case FunctionAction.LatchOn:
        case FunctionAction.LatchOff:
            return true;

        default:
            return false;
    }
}

async function broadcastSpeedChange(locoId: number, speed: number, reverse: boolean) {
    setLocoSpeedAndDirection(locoId, speed, reverse);
    await clientBroadcast<LocoSpeedRequest>(RequestType.LocoSpeed, {
        locoId: locoId,
        speed: speed,
        reverse: reverse
    });
}

async function broadcastFunctionChange(locoId: number, func: number, action: FunctionAction) {
    setLocoFunction(locoId, func, action === FunctionAction.LatchOn);
    await clientBroadcast<LocoFunctionRequest>(RequestType.LocoFunction, {
        locoId: locoId,
        function: func,
        action: action
    });
}

async function onLocoSpeed(request: LocoSpeedRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
    await batch.commit();

    await ok(send);
    await broadcastSpeedChange(request.locoId, request.speed, !!request.reverse);
};

function ActionApiToCommandStation(action: FunctionAction) {
    switch (action) {
        case FunctionAction.Trigger: return CommandStation.FunctionAction.TRIGGER;
        case FunctionAction.LatchOn: return CommandStation.FunctionAction.LATCH_ON;
        case FunctionAction.LatchOff: return CommandStation.FunctionAction.LATCH_OFF;
        default: throw new Error(`Invalid action ${action}`);
    }
};

async function onLocoFunction(request: LocoFunctionRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveFunction(request.locoId, request.function, ActionApiToCommandStation(request.action));
    await batch.commit();

    await ok(send);

    if (isStatefullAction(request.action)) {
        broadcastFunctionChange(request.locoId, request.function, request.action);
    }
};

async function onEmergencyStop(data: any, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    if (_seenLocos.size !== 0) {
        const batch = await application.commandStation.beginCommandBatch();
        for (const locoId of _seenLocos.keys()) {
            log.debug(() => `Stopping loco ${locoId}`);
            batch.setLocomotiveSpeed(locoId, 0);
        }
        await batch.commit();
    }
    
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

// This is mainly used for testing
export function resetSeenLocos() {
    _seenLocos.clear();
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoSpeed, onLocoSpeed);
    map.set(RequestType.LocoFunction, onLocoFunction);
    map.set(RequestType.EmergencyStop, onEmergencyStop);
    map.set(RequestType.LocoSpeedRefresh, onLocoSpeedRefresh);
}