import * as express from "express";
import * as expressWs from "express-ws";
import * as cookieParser from "cookie-parser";
import * as apiRouter from "./routers/apiRouter";
import * as authRouter from "./routers/authRouter";
import * as backupRouter from "./routers/backupRouter";
import { getControlWebSocketRoute } from "./handlers/handlers";

export async function registerMiddleware(app: expressWs.Application) {
    app.set("view engine", "pug");
    app.set("views", "./views");

    app.use(cookieParser());
    app.use(authRouter.pingSession());
    app.use(express.static("static"));
    app.ws("/control/v1", getControlWebSocketRoute());
    app.use("/api/v1", await apiRouter.getRouter());
    app.use("/auth", await authRouter.getRouter());
    app.use("/backup", await backupRouter.getRouter());
    app.use((_, res) => {
        res.sendStatus(404);
    });
}
