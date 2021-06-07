import * as express from "express";
import { application } from "../../application";
import { COOKIE_SESSION_ID } from "../../common/constants";

const _authRouter = express.Router();
_authRouter.use(express.urlencoded({extended: true}));

_authRouter.route("/")
.get((_req, res, _next) => {
    res.render('auth/index');
})
.post(async (req, res) => {
    let username = "";
    try {
        username = req.body["username"];
        const password = req.body["password"];
        const session = await application.sessionManager.signIn(username, password);
        res.cookie(COOKIE_SESSION_ID, session.id, {
            expires: session.expires
        }).redirect("/");
    }
    catch (err) {
        res.render("auth/index", {
            username: username,
            errorMessage: err
        });
    }
})

_authRouter.route("/logout")
.get(async (req, res) => {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    if (sessionId) {
        await application.sessionManager.signOut(sessionId);
    }
    res.clearCookie(COOKIE_SESSION_ID).redirect("/");
})

export async function getRouter(): Promise<express.Router> {
    return _authRouter;
}