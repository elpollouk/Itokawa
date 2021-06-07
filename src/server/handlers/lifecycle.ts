import { HandlerMap, Sender, ok, ConnectionContext } from "./handlers"
import { application } from "../../application";
import { LifeCycleRequest, LifeCycleAction, LifeCyclePingResponse, RequestType } from "../../common/messages";
import { updateApplication, updateOS } from "../updater";

async function onLifeCycleMessage(_context: ConnectionContext, request: LifeCycleRequest, send: Sender): Promise<void> {
    switch(request.action) {
        case LifeCycleAction.ping:
            const response: LifeCyclePingResponse = {
                packageVersion: application.packageVersion,
                commandStation: application.commandStation ? `${application.commandStation.deviceId} ${application.commandStation.version}` : "",
                commandStationState: application.commandStation ? application.commandStation.state : -1,
                gitrev: application.gitrev,
                publicUrl: application.publicUrl,
                lastMessage: true,
                data: "OK"
            };
            await send(response);
            break;

        case LifeCycleAction.shutdown:
            await application.lifeCycle.shutdown();
            await ok(send);
            break;

        case LifeCycleAction.restart:
            await application.lifeCycle.restart();
            await ok(send);
            break;

        case LifeCycleAction.update:
            await updateApplication(send);
            break;

        case LifeCycleAction.updateOS:
            await updateOS(send);
            break;

        default:
            throw new Error(`Unrecognised life cycle action: ${request.action}`);
    }
}

export function registerHandlers(map: HandlerMap) {
    map.set(RequestType.LifeCycle, onLifeCycleMessage);
}