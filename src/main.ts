import { Logger, LogLevel } from "./utils/logger";
import { AddressInfo } from "net";
import * as express from "express";
import * as expressWs from "express-ws";
import * as program from "commander";
import * as ngrok from "ngrok";
import * as lifecycle from "./server/lifecycle";
import { addCommonOptions, applyLogLevel, openDevice } from "./utils/commandLineArgs";
import { parseIntStrict } from "./utils/parsers";
import { CommandStationState } from "./devices/commandStations/commandStation";

addCommonOptions(program);
program
    .option("-p --port <port>", "Port to listen on", "8080")
    .option("--datadir <path>", "Directory to save data to")
    .option("--ngrok", "Enable ngrok endpoint");

Logger.logLevel = LogLevel.DEBUG;
let log = new Logger("Main");

enum RequestType {
    LocoSpeed = 1
}

interface CommandRequest {
    type: RequestType,
    requestTime: string
}

interface LocoSpeedRequest extends CommandRequest {
    locoId: number,
    speed: number,
    reverse: boolean
}

interface CommandResponse {
    data?: any,
    error?: string,
    responseTime: string
}

async function main()
{
    program.parse(process.argv);
    applyLogLevel(program);

    await lifecycle.start(program.datadir);

    const cs = await openDevice(program);
    if (!cs) log.error("No devices found");
    else log.display(`Using ${cs.deviceId} ${cs.version}`);

    const ews = expressWs(express());
    const app = ews.app;

    /*app.get("/", (req, res) => {
        res.send("<h1>Hello World</h1>");
    });*/

    app.ws("/control", (ws, req) => {
        ws.on("message", async (msg) => {
            log.info(`WebSocket Message: ${msg}`);
            if (!cs) return;
            let response: CommandResponse;
            try {
                log.debug(() => `Command Station State = ${CommandStationState[cs.state]}`);
                const request = JSON.parse(msg.toString()) as LocoSpeedRequest;
                if (request.type != RequestType.LocoSpeed) throw new Error(`Invalid request type: ${request.type}`);

                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
                await batch.commit();

                response = {
                    data: "OK",
                    responseTime: Logger.timestamp()
                }
            }
            catch (ex) {
                response = {
                    error: ex.message,
                    responseTime: Logger.timestamp()
                }
            }

            ws.send(JSON.stringify(response));
        });
        ws.on("close", () => {
            log.info("Web socket closed");
        });
        log.info("Web socket connected");
    });

    app.use(express.static("static"));

    const port = parseIntStrict(program.port);

    const server = app.listen(port, (err) => {
        if (err) {
            log.error(`Failed to start listening on port ${port}`);
            log.error(err);
            return;
        }

        const address: AddressInfo = server.address() as AddressInfo;
        log.display(`Listening on ${address.address}:${address.port}`);

        if (program.ngrok) {
            ngrok.connect(port).then((url) => {
                log.display(`ngrok url: ${url}`);
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