import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { timestamp } from "../common/time";
import { AddressInfo } from "net";
import * as os from "os";
import * as express from "express";
import * as expressWs from "express-ws";
import * as program from "commander";
import * as ngrok from "../publishers/ngrok";
import { application } from "../application";
import { addCommonOptions,  openDevice } from "../utils/commandLineArgs";
import { parseIntStrict } from "../utils/parsers";
import { ICommandStation } from "../devices/commandStations/commandStation";
import * as messages from "../common/messages";
import { execShutdown, execRestart } from "./shutdown";
import { updateApplication } from "./updateApplication";
import { ConfigNode } from "../utils/config";

addCommonOptions(program);
program
    .option("-p --port <port>", "Port to listen on")
    .option("--datadir <path>", "Directory to save data to")
    .option("--ngrok", "Enable ngrok endpoint");

let log = new Logger("Main");
let _commandStation: ICommandStation = null;
let _publicUrl = null;
const _seenLocos = new Set<number>();

type Sender = (message: messages.CommandResponse)=>Promise<boolean>;
const messageHandlers = new Map<messages.RequestType, (msg: messages.CommandRequest, send: Sender)=>Promise<void>>();

async function ok(sender: Sender): Promise<void> {
    await sender({
        lastMessage: true,
        data: "OK"
    });
}

messageHandlers.set(messages.RequestType.LifeCycle, async (msg, send): Promise<void> => {
    const request = msg as messages.LifeCycleRequest;
    switch(request.action) {
        case messages.LifeCycleAction.ping:
            const response: messages.LifeCyclePingResponse = {
                commandStation: _commandStation ? _commandStation.deviceId : "",
                commandStationState: _commandStation ? _commandStation.state : -1,
                gitrev: application.gitrev,
                publicUrl: _publicUrl,
                lastMessage: true,
                data: "OK"
            };
            await send(response);
            break;

        case messages.LifeCycleAction.shutdown:
            await application.shutdown();
            await ok(send);
            break;

        case messages.LifeCycleAction.restart:
            await execRestart();
            await ok(send);
            break;

        case messages.LifeCycleAction.update:
            await updateApplication(send);
            break;

        default:
            throw new Error(`Unrecognised life cycle action: ${request.action}`);
    }
});

messageHandlers.set(messages.RequestType.LocoSpeed, async (msg, send): Promise<void> => {
    if (!_commandStation) throw new Error("No command station connected");
    const request = msg as messages.LocoSpeedRequest;
    if (request.type !== messages.RequestType.LocoSpeed) throw new Error(`Invalid request type: ${request.type}`);

    const batch = await _commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
    await batch.commit();

    _seenLocos.add(request.locoId);

    await ok(send);
});

messageHandlers.set(messages.RequestType.EmergencyStop, async (msg, send): Promise<void> => {
    if (!_commandStation) throw new Error("No command station connected");
    log.info("Issuing emergency stop");

    const batch = await _commandStation.beginCommandBatch();
    for (const locoId of _seenLocos) {
        log.debug(() => `Stopping loco ${locoId}`);
        batch.setLocomotiveSpeed(locoId, 0);
    }
    await batch.commit();

    await ok(send);
});

async function main()
{
    program.parse(process.argv);

    await application.start(program, true);
    application.onshtudown = execShutdown;

    _commandStation = await openDevice(program);
    if (!_commandStation) log.error("No devices found");
    else log.display(`Using ${_commandStation.deviceId} ${_commandStation.version}`);

    const ews = expressWs(express());
    const app = ews.app;

    /*app.get("/", (req, res) => {
        res.send("<h1>Hello World</h1>");
    });*/

    app.ws("/control", (ws, req) => {
        // We wrap WebSocket sending so that we can perform additional checks and augment the
        // message with diagnostics data.
        // It also protects us againsts accidental WebSocket misuse as we never provide handlers
        // direct access to the socket.
        const send = (msg: messages.CommandResponse): Promise<boolean> => {
            if (ws.readyState !== 1) {
                // We handle disconnections without throwing as it's not always possible to cancel
                // in flight promises and we don't want an exception to fail an important operation
                // such as updating just because no-one has the web page open.
                log.warning("Attempt to send data to closed WebSocket");
                return Promise.resolve(false);
            }
            msg.responseTime = timestamp()
            ws.send(JSON.stringify(msg));
            return Promise.resolve(true);
        };

        ws.on("message", async (msg) => {
            log.debug(() => `WebSocket Message: ${msg}`);
            try {
                const request = JSON.parse(msg.toString()) as messages.CommandRequest;
                if (!messageHandlers.has(request.type)) throw new Error(`Unrecognised request type: ${request.type}`);
                await messageHandlers.get(request.type)(request, send);
            }
            catch (ex) {
                log.warning(() => `WebSocket request failed: ${ex.stack}`);
                send({
                    lastMessage: true,
                    error: ex.message
                });
            }
        });
        ws.on("close", () => {
            log.info("Web socket closed");
        });
        log.info("Web socket connected");
    });

    app.use(express.static("static"));

    let port = program.port || application.config.get("server.port", 8080);
    if (typeof(port) === "string") port = parseIntStrict(port);

    const server = app.listen(port, (err: any) => {
        if (err) {
            log.error(`Failed to start listening on port ${port}`);
            log.error(err);
            return;
        }

        const address: AddressInfo = server.address() as AddressInfo;
        _publicUrl = `http://${os.hostname()}:${address.port}/`;
        log.display(`Listening on ${_publicUrl}`);

        const ngrokConfig = application.config.getAs<ConfigNode>("server.publish.ngrok");
        if (program.ngrok || ngrokConfig) {
            ngrok.publish(port, ngrokConfig).then((url) => {
                log.display(`ngrok url: ${url}`);
                _publicUrl = url;
            }, (err) => {
                log.error("Failed to register ngrok endpoint");
                log.error(err);
            });
        }
    })
} 


main().catch((err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});