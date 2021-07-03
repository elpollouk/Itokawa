import * as express from "express";
import { application } from "../../application";
import { Logger } from "../../utils/logger";
import { Config } from "../../common/api";

export function registerRoutes(router: express.Router, log: Logger) {
    router.route("/config")
    .get(async (_req, res, next) => {
        try {
            log.info("Requesting config...");
            const config: Config = {};

            if (application.config.has("client")) config.client = application.config.get("client");

            const flags = [...application.featureFlags.getFlags()];
            if (flags.length)
                config.features = flags;

            res.json(config);
        }
        catch (err) {
            log.error("GET /config failed")
            log.error(err.stack);
            next(err);
        }
    })
}