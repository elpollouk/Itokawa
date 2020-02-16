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

apiRouter.route("/locos")
.get((_req, res, next) => {
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

apiRouter.route("/locos/:id")
.get((req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const locos = _locos.locos;
        for (let i = 0; i < locos.length; i++) {
            if (id === locos[i].id) {
                res.json(locos[i]);
                return;
            }
        }

        res.statusCode = 404;
        res.send();
    }
    catch (err) {
        next(err);
    }   
})
.post((req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const data: api.Loco = req.body;
        const locos = _locos.locos;
        for (let i = 0; i < locos.length; i++) {
            if (id === locos[i].id) {
                data.id = id;
                locos[i] = data;
                res.send();
                return;
            }
        }

        res.statusCode = 404;
        res.send();
    }
    catch (err) {
        next(err);
    }   
})
.delete((req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const locos = _locos.locos;
        for (let i = 0; i < locos.length; i++) {
            if (id === locos[i].id) {
                locos.splice(i, 1);
                break;
            }
        }
        res.send();
    }
    catch (err) {
        next(err);
    }
});