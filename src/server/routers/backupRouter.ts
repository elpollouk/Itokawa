import * as express from "express";

const _router = express.Router();
_router.route("/")
.get(async (_, res) => {
    res.send("Ok");
});

export async function getRouter(): Promise<express.Router> {
    return _router;
}