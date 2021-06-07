import { Logger } from "../../utils/logger";
import { WebsocketRequestHandler } from "express-ws";
import * as ws from "ws";
import { CommandResponse, RequestType, TransportMessage, generateMessageTag } from "../../common/messages";
import { timestamp } from "../../common/time";

// Specific message handlers
import * as lifecycleHandler from "./lifecycle";
import * as locoHandler from "./loco";
import * as cvHandler from "./cv";
import { COOKIE_SESSION_ID } from "../../common/constants";
import { application } from "../../application";
import { Permissions } from "../sessionmanager";

const log = new Logger("ControlMessageHandler");

export interface ConnectionContext {
    sessionId?: string;
    hasPermission: (permission: Permissions) => boolean;
}

export type Sender = (message: CommandResponse)=>Promise<boolean>;
export type HandlerMap = Map<RequestType, (context: ConnectionContext, msg: any, send: Sender)=>Promise<void>>;

export async function ok(send: Sender) {
    await send({
        lastMessage: true,
        data: "OK"
    });
}

const messageHandlers = new Map<RequestType, (context: ConnectionContext, msg: any, send: Sender)=>Promise<void>>();
const clientSockets = new Set<ws>();

export function resetHandler() {
    messageHandlers.clear();
    clientSockets.clear();
}

export async function clientBroadcast<T>(type: RequestType, data: T, exclude?: ws[] | ws | Set<ws>): Promise<void> {
    if (exclude instanceof(ws)) {
        exclude = new Set([exclude]);
    }
    else if (Array.isArray(exclude)) {
        exclude = new Set(exclude);
    }
    else {
        exclude = exclude || new Set();
    }

    const message: TransportMessage = {
        type: type,
        tag: generateMessageTag(),
        requestTime: timestamp(),
        data: data
    };
    const raw = JSON.stringify(message);

    for (const client of clientSockets) {
        if (exclude.has(client)) continue;
        client.send(raw);
    }
}

export function getControlWebSocketRoute(): WebsocketRequestHandler {
    // Register the message handlers in one pass
    lifecycleHandler.registerHandlers(messageHandlers);
    locoHandler.registerHandlers(messageHandlers);
    cvHandler.registerHandlers(messageHandlers);
    
    return (ws, req) => {
        const sessionId = req.cookies[COOKIE_SESSION_ID];
        const context: ConnectionContext = {
            sessionId: sessionId,
            hasPermission: (permission: Permissions) => application.sessionManager.hasPermission(permission, sessionId)
        };

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
                await application.sessionManager.ping(context.sessionId);
                const request = JSON.parse(msg.toString()) as TransportMessage;
                if (!messageHandlers.has(request.type)) throw new Error(`Unrecognised request type: ${request.type}`);
                send = createResponder(request.tag);
                await messageHandlers.get(request.type)(context, request.data, send);
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
            clientSockets.delete(ws);
            log.info("Web socket closed");
        });

        clientSockets.add(ws);
        log.info("Web socket connected");
        if (context.sessionId) log.info(() => `Session id: ${context.sessionId}`);
    };
}