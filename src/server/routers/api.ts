import * as express from "express";
import * as api from "../../common/api";

export const apiRouter = express.Router();

apiRouter.route("/locos").get((req, res, next) => {
    try {
        const locos: api.Loco[] = [{
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
        }];

        res.json({
            locos: locos
        });
    }
    catch (err) {
        next(err);
    }
});