import { Logger, LogLevel } from "./utils/logger";
import { AddressInfo } from "net";
import * as express from "express";
import * as expressWs from "express-ws";
import * as program from "commander";
import { addCommonOptions, applyLogLevel, openDevice } from "./utils/commandLineArgs";
import { parseIntStrict } from "./utils/parsers";
import { encodeLongAddress } from "./devices/commandStations/nmraUtils";

addCommonOptions(program);
program
    .option("-p --port <port>", "Port to listen on", "8080");

Logger.logLevel = LogLevel.DEBUG;
let log = new Logger("Main");

interface LocoSpeedRequest {
    locoId: number,
    speed: number,
    reverse: boolean
}

async function main()
{
    program.parse(process.argv);
    applyLogLevel(program);

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
            const request = JSON.parse(msg.toString()) as LocoSpeedRequest;
            const batch = await cs.beginCommandBatch();
            batch.setLocomotiveSpeed(request.locoId, request.speed, request.reverse);
            await batch.commit();
        });
        log.info(`Web socket connected: remote=${req.ip}`);
    });

    app.use(express.static("static"));

    const server = app.listen(parseIntStrict(program.port), (err) => {
        const address: AddressInfo = server.address() as AddressInfo;
        log.display(`Listening on ${address.address}:${address.port}`);
    })
} 


main().catch((err) => {
    log.error("*** UNHANDLED EXCEPTION ***")
    log.error(err.stack);
    process.exit(1);
});