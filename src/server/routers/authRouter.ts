import * as express from "express";
import { COOKIE_SESSION_ID } from "../../common/constants";
import { SessionManager } from "../sessionmanager";

const _sessionManager = new SessionManager(); 
const _authRouter = express.Router();
_authRouter.use(express.urlencoded({extended: true}));

_authRouter.route("/")
.get((_req, res, _next) => {
    res.render('auth/index');
})
.post(async (req, res, _next) => {
    let username = "";
    try {
        username = req.body["username"];
        const password = req.body["password"];
        const session = await _sessionManager.signIn(username, password);
        res.cookie(COOKIE_SESSION_ID, session.id).redirect("/");
    }
    catch (err) {
        res.render("auth/index", {
            username: username,
            errorMessage: err
        });
    }
})

_authRouter.route("/logout")
.get((req, res, _next) => {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    if (sessionId) {
        _sessionManager.signOut(sessionId);
    }
    res.clearCookie(COOKIE_SESSION_ID).redirect("/auth");
})

export async function getRouter(): Promise<express.Router> {
    return _authRouter;
}