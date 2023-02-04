import { Logger } from "../../utils/logger";
import * as express from "express";
import * as api from "../../common/api";
import * as config from "./configRouter";
import { application } from "../../application";
import { LocoRepository } from "../../model/locoRepository";
import { requirePermission } from "./authRouter";
import { Permissions } from "../sessionmanager";

const log = new Logger("API");

const _apiRouter = express.Router();
let _locoRepo: LocoRepository = null;
_apiRouter.use(express.json());

_apiRouter.route("/track_locos")
.get(async (_req, res, next) => {
    try {
        const locos = await _locoRepo.list();
        const view = await application.database.openLocoView(api.VIEW_ONTRACK);
        const locoIds = await view.locoIds;
        const onTrack: api.Loco[] = [];

        // Filter out locos that aren't in the "On Track" view
        for (const loco of locos) {
            if (locoIds.has(loco.id)) {
                onTrack.push(loco);
            }
        }

        res.json(onTrack);
    }
    catch (err) {
        log.error("GET /locos failed")
        log.error(err.stack);

        next(err);
    }
})

_apiRouter.route("/locos")
.get(async (_req, res, next) => {
    try {
        const locos = await _locoRepo.list();
        const view = await application.database.openLocoView(api.VIEW_ONTRACK);
        const locoIds = await view.locoIds;

        // Populate ephemeral data
        for (const loco of locos) {
            if (locoIds.has(loco.id)) {
                loco._emphemeral = {
                    onTrack: true
                }
            }
        }

        res.json(locos);
    }
    catch (err) {
        log.error("GET /locos failed")
        log.error(err.stack);

        next(err);
    }
})
.all(requirePermission(Permissions.TRAIN_EDIT))
.post(async (req, res, next) => {
    try {
        const loco: api.Loco = req.body;
        // Strip out any ephemeral data that might be returned to us
        delete loco._emphemeral;
        await _locoRepo.insert(loco);

        res.json(loco);
    }
    catch (err) {
        log.error("POST /locos failed")
        log.error(err.stack);

        next(err);
    }
});

_apiRouter.route("/locos/:id")
.get(async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const loco = await _locoRepo.get(id);

        if (!loco) {
            res.statusCode = 404;
            res.send();
        }
        else {
            res.json(loco);
        }
    }
    catch (err) {
        log.error("GET /locos/id failed")
        log.error(err.stack);

        next(err);
    }   
})
.all(requirePermission(Permissions.TRAIN_EDIT))
.post(async (req, res, next) => {
    try {
        const data: api.Loco = req.body;
        data.id = parseInt(req.params.id);

        await _locoRepo.update(data);

        res.send();
    }
    catch (err) {
        log.error("POST /locos/id failed")
        log.error(err.stack);

        next(err);
    }   
})
.delete(async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        await _locoRepo.delete(id);

        res.send();
    }
    catch (err) {
        log.error("DELETE /locos/id failed")
        log.error(err.stack);

        next(err);
    }
});

_apiRouter.route("/locoview/:name/:id")
.all(requirePermission(Permissions.TRAIN_SELECT))
.put(async (req, res, next) => {
    try {
        const viewName = req.params.name;
        const locoId = parseInt(req.params.id);

        log.info(() => `Adding loco ${locoId} to view "${viewName}"`);

        if (viewName == api.VIEW_ONTRACK) {
            const view = await application.database.openLocoView(viewName);
            await view.addLoco(locoId);
        }
        else {
            res.statusCode = 400;
        }

        res.send();
    }
    catch (err) {
        log.error(`PUT /locoview/${req.params.name}/${req.params.id} failed`)
        log.error(err.stack);

        next(err);
    }
})
.delete(async (req, res, next) => {
    try {
        const viewName = req.params.name;
        const locoId = parseInt(req.params.id);

        log.info(() => `Removing loco ${locoId} from view "${viewName}"`);

        if (viewName == api.VIEW_ONTRACK) {
            const view = await application.database.openLocoView(viewName);
            await view.removeLoco(locoId);
        }
        else {
            res.statusCode = 400;
        }

        res.send();
    }
    catch (err) {
        log.error(`PUT /locoview/${req.params.name}/${req.params.id} failed`)
        log.error(err.stack);

        next(err);
    }
})

config.registerRoutes(_apiRouter, log);

export async function getRouter(): Promise<express.Router> {
    _locoRepo = await application.database.openRepository(LocoRepository);
    return _apiRouter;
}
