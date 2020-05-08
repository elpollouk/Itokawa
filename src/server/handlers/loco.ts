import { Logger } from "../../utils/logger";
import { HandlerMap, Sender, ok, clientBroadcast } from "./handlers"
import { application } from "../../application";
import { RequestType, LocoSpeedRequest, LocoFunctionRequest, FunctionAction, LocoFunctionRefreshRequest } from "../../common/messages";
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
        speed: 0,
        reverse: false,
        functions: new Array(NUM_FUNCTIONS).fill(false)
    } as LocoSetting;
}

function getLocoState(locoId: number) {
    let loco = _seenLocos.get(locoId);
    if (!loco) {
        loco = createLoco();
        _seenLocos.set(locoId, loco);
    }
    return loco;
}

function setLocoSpeedAndDirection(locoId: number, speed: number, reverse: boolean) {
    let loco = getLocoState(locoId);
    loco.speed = speed;
    loco.reverse = reverse
}

function setLocoFunction(locoId: number, func: number, state: boolean) {
    let loco = getLocoState(locoId);
    loco.functions[func] = state;
}

function isStatefulAction(action: FunctionAction) {
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
    log.info(() => `broadcastFunctionChange: locoId=${locoId}, function=${func}, action=${action}`);

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

    log.info(() => `onLocoFunction: locoId=${request.locoId}, function=${request.function}, action=${request.action}`);

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveFunction(request.locoId, request.function, ActionApiToCommandStation(request.action));
    await batch.commit();

    await ok(send);

    if (isStatefulAction(request.action)) {
        broadcastFunctionChange(request.locoId, request.function, request.action);
    }
};

async function onEmergencyStop(data: any, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    if (_seenLocos.size !== 0) {
        const batch = await application.commandStation.beginCommandBatch();
        for (const [locoId, loco] of _seenLocos.entries()) {
            log.debug(() => `Stopping loco ${locoId}`);
            batch.setLocomotiveSpeed(locoId, 0, loco.reverse);
        }
        await batch.commit();
    }
    
    await ok(send);

    for (const [locoId, loco] of _seenLocos.entries())
        await broadcastSpeedChange(locoId, 0, loco.reverse);
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

async function onLocoFunctionRefresh(request: LocoFunctionRefreshRequest, send: Sender): Promise<void> {
    if (!application.commandStation) throw new Error("No command station connected");

    log.info(() => `onLocoFunctionRefresh: locoId=${request.locoId}`);

    const loco = _seenLocos.get(request.locoId);
    const functions = loco?.functions || []
    for (let i = 0; i < functions.length; i++) {
        if (!functions[i]) continue;
        await send({
            lastMessage: false,
            data: {
                locoId: request.locoId,
                function: i,
                action: FunctionAction.LatchOn
            } as LocoFunctionRequest
        });
    }

    await ok(send);
}

// This is used for testing
export function resetSeenLocos() {
    _seenLocos.clear();
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LocoSpeed, onLocoSpeed);
    map.set(RequestType.LocoFunction, onLocoFunction);
    map.set(RequestType.EmergencyStop, onEmergencyStop);
    map.set(RequestType.LocoSpeedRefresh, onLocoSpeedRefresh);
    map.set(RequestType.LocoFunctionRefresh, onLocoFunctionRefresh);
}