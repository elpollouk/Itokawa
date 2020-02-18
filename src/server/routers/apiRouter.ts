import { Logger } from "../../utils/logger";
import * as express from "express";
import * as api from "../../common/api";
import { application } from "../../application";
import { LocoRepository } from "../../model/locoRepository";
import expressWs = require("express-ws");

const log = new Logger("API");

const _apiRouter = express.Router();
let _locoRepo: LocoRepository = null;
_apiRouter.use(express.json());

_apiRouter.route("/locos")
.get(async (_req, res, next) => {
    try {
        const locos = await _locoRepo.list();
        const response: api.Locos = {
            locos: locos
        }
        res.json(response);
    }
    catch (err) {
        log.error("GET /locos failed")
        log.error(err.stack);

        next(err);
    }
}).post(async (req, res, next) => {
    try {
        const locos: api.Locos = req.body;

        for (const loco of locos.locos) {
            await _locoRepo.insert(loco);
        }

        res.json(locos);
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

export async function getRouter(): Promise<expressWs.Router> {
    _locoRepo = (await application.database.openRepository(LocoRepository)) as LocoRepository;
    return _apiRouter;
}
