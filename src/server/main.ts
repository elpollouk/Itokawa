import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { AddressInfo } from "net";
import * as os from "os";
import * as express from "express";
import * as expressWs from "express-ws";
import * as program from "commander";
import * as ngrok from "../publishers/ngrok";
import { application } from "../application";
import { addCommonOptions,  openDevice } from "../utils/commandLineArgs";
import { parseIntStrict } from "../utils/parsers";
import { execShutdown } from "./shutdown";
import { ConfigNode } from "../utils/config";

// WebSocket Message handlers
import { getControlWebSocketRoute } from "./handlers/handlers";

addCommonOptions(program);
program
    .option("-p --port <port>", "Port to listen on")
    .option("--datadir <path>", "Directory to save data to")
    .option("--ngrok", "Enable ngrok endpoint");

let log = new Logger("Main");


async function main()
{
    program.parse(process.argv);

    await application.start(program, true);
    application.onshtudown = execShutdown;

    application.commandStation = await openDevice(program);
    if (!application.commandStation) log.error("No devices found");
    else log.display(`Using ${application.commandStation.deviceId} ${application.commandStation.version}`);

    const ews = expressWs(express());
    const app = ews.app;

    /*app.get("/", (req, res) => {
        res.send("<h1>Hello World</h1>");
    });*/

    app.ws("/control", getControlWebSocketRoute());
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
        application.publicUrl = `http://${os.hostname()}:${address.port}/`;
        log.display(`Listening on ${application.publicUrl}`);

        const ngrokConfig = application.config.getAs<ConfigNode>("server.publish.ngrok");
        if (program.ngrok || ngrokConfig) {
            ngrok.publish(port, ngrokConfig).then((url) => {
                log.display(`ngrok url: ${url}`);
                application.publicUrl = url;
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