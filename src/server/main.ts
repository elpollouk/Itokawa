import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

import { AddressInfo } from "net";
import * as os from "os";
import * as express from "express";
import * as expressWs from "express-ws";
import * as cookieParser from "cookie-parser";
import * as program from "commander";
import * as ngrok from "../publishers/ngrok";
import { application } from "../application";
import { addCommonOptions } from "../utils/commandLineArgs";
import { parseIntStrict } from "../utils/parsers";
import { execShutdown, execRestart, shutdownCheck, restartCheck } from "./shutdown";
import { ConfigNode } from "../utils/config";
import * as apiRouter from "./routers/apiRouter";
import * as authRouter from "./routers/authRouter";

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
    application.lifeCycle.onshutdownbegin = shutdownCheck;
    application.lifeCycle.onshutdown = execShutdown;
    application.lifeCycle.onrestartbegin = restartCheck;
    application.lifeCycle.onrestart = execRestart;

    const ews = expressWs(express());
    const app = ews.app;

    app.set('view engine', 'pug');
    app.set('views','./views');

    app.use(cookieParser());
    app.ws("/control/v1", getControlWebSocketRoute());
    app.use(express.static("static"));
    app.use("/auth", (await authRouter.getRouter()));
    app.use(authRouter.pingSession);
    app.use("/api/v1", (await apiRouter.getRouter()));

    let port = program.port || application.config.get("server.port", 8080);
    if (typeof(port) === "string") port = parseIntStrict(port);

    const server = app.listen(port, () => {
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