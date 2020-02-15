import * as express from "express";
import * as api from "../../common/api";

export const apiRouter = express.Router();
apiRouter.use(express.json());

let _nextId = 4;
const _locos: api.Locos = {
    locos: [{
        id: 1,
        address: 4305,
        name: "Class 43 HST",
        speeds: [32, 64, 96]
    }, {
        id: 2,
        address: 2732,
        name: "GWR 0-6-6",
        speeds: [32, 48, 64]
    }, {
        id: 3,
        address: 2328,
        name: "LMS 2-6-4",
        speeds: [32, 56, 80]
    }]
};

apiRouter.route("/locos").get((req, res, next) => {
    try {
        res.json(_locos);
    }
    catch (err) {
        next(err);
    }
}).post((req, res, next) => {
    try {
        const locos: api.Locos = req.body;

        for (const loco of locos.locos) {
            // TODO - Verify valid settings
            loco.id = _nextId++;
            _locos.locos.push(loco);
        }

        res.json(locos);
    }
    catch (err) {
        next(err);
    }
});