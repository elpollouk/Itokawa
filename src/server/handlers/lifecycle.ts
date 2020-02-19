import { HandlerMap, Sender, ok } from "./handlers"
import { application } from "../../application";
import { CommandRequest, LifeCycleRequest, LifeCycleAction, LifeCyclePingResponse, RequestType } from "../../common/messages";
import { updateApplication } from "../updateApplication";

async function onLifeCycleMessage(msg: CommandRequest, send: Sender): Promise<void> {
    const request = msg as LifeCycleRequest;
    switch(request.action) {
        case LifeCycleAction.ping:
            const response: LifeCyclePingResponse = {
                commandStation: application.commandStation ? application.commandStation.deviceId : "",
                commandStationState: application.commandStation ? application.commandStation.state : -1,
                gitrev: application.gitrev,
                publicUrl: application.publicUrl,
                lastMessage: true,
                data: "OK"
            };
            await send(response);
            break;

        case LifeCycleAction.shutdown:
            await application.shutdown();
            await ok(send);
            break;

        case LifeCycleAction.restart:
            await application.restart();
            await ok(send);
            break;

        case LifeCycleAction.update:
            await updateApplication(send);
            break;

        default:
            throw new Error(`Unrecognised life cycle action: ${request.action}`);
    }
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LifeCycle, onLifeCycleMessage);
}