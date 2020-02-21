import { Logger } from "../../utils/logger";
import { WebsocketRequestHandler } from "express-ws";
import { CommandResponse, RequestType, TransportMessage } from "../../common/messages";
import { timestamp } from "../../common/time";

// Specific message handlers
import * as lifecycleHandler from "./lifecycle";
import * as locoHandler from "./loco";

const log = new Logger("ControlMessageHandler");

export type Sender = (message: CommandResponse)=>Promise<boolean>;
export type HandlerMap = Map<RequestType, (msg: any, send: Sender)=>Promise<void>>;

export async function ok(send: Sender) {
    await send({
        lastMessage: true,
        data: "OK"
    });
}

const messageHandlers = new Map<RequestType, (msg: any, send: Sender)=>Promise<void>>();

export function getControlWebSocketRoute(): WebsocketRequestHandler {
    // Register the message handlers in one pass
    lifecycleHandler.registerHandlers(messageHandlers);
    locoHandler.registerHandlers(messageHandlers);
    
    return (ws, req) => {
        // We wrap WebSocket sending so that we can perform additional checks and augment the
        // message with diagnostics data.
        // It also protects us againsts accidental WebSocket misuse as we never provide handlers
        // direct access to the socket.
        function createResponder(tag: string): Sender {
            return (data: CommandResponse): Promise<boolean> => {
                if (ws.readyState !== 1) {
                    // We handle disconnections without throwing as it's not always possible to cancel
                    // in flight promises and we don't want an exception to fail an important operation
                    // such as updating just because no-one has the web page open.
                    log.warning("Attempt to send data to closed WebSocket");
                    return Promise.resolve(false);
                }
                const msg: TransportMessage = {
                    type: RequestType.CommandResponse,
                    requestTime: timestamp(),
                    tag: tag,
                    data: data
                }
                ws.send(JSON.stringify(msg));
                return Promise.resolve(true);
            };
        }

        ws.on("message", async (msg) => {
            log.debug(() => `WebSocket Message: ${msg}`);
            let send: Sender = null;
            try {
                const request = JSON.parse(msg.toString()) as TransportMessage;
                if (!messageHandlers.has(request.type)) throw new Error(`Unrecognised request type: ${request.type}`);
                send = createResponder(request.tag);
                await messageHandlers.get(request.type)(request.data, send);
            }
            catch (ex) {
                log.warning(() => `WebSocket request failed: ${ex.stack}`);
                send && send({
                    lastMessage: true,
                    error: ex.message
                });
            }
        });

        ws.on("close", () => {
            log.info("Web socket closed");
        });
        log.info("Web socket connected");
    };
}