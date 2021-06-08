import * as express from "express";
import { application } from "../../application";
import { COOKIE_SESSION_ID } from "../../common/constants";
import { Permissions } from "../sessionmanager";

const _authRouter = express.Router();
_authRouter.use(express.urlencoded({extended: true}));

_authRouter.route("/")
.get(async (req, res) => {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    const session = application.sessionManager.getSession(sessionId);
    if (session && session.isValid) {
        await session.ping();
        res.cookie(COOKIE_SESSION_ID, session.id, {
            expires: session.expires
        }).redirect("/");
    }
    else {
        res.clearCookie(COOKIE_SESSION_ID).render('auth/index');
    }
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
});

_authRouter.route("/logout")
.get(async (req, res) => {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    if (sessionId) {
        await application.sessionManager.signOut(sessionId);
    }
    res.clearCookie(COOKIE_SESSION_ID).redirect("/");
});

_authRouter.use(requirePermission(Permissions.SESSION_MANAGE));
_authRouter.route("/clearAllSessions")
.get(async(_req, res) => {
    const result = {};
    try {
        for (const session of application.sessionManager.getSessions()) {
            await session.expire();
        }
        await application.sessionManager.removeExpired();
        result["message"] = "All sessions cleared.";
    }
    catch (err) {
        result["errorMessage"] = err;
    }
    res.render("auth/result", result);
});
_authRouter.route("/clearExpiredSessions")
.get(async(_req, res) => {
    const result = {};
    try {
        await application.sessionManager.removeExpired();
        result["message"] = "Expired sessions cleared.";
    }
    catch (err) {
        result["errorMessage"] = err;
    }
    res.render("auth/result", result);
});

export async function getRouter(): Promise<express.Router> {
    return _authRouter;
}

export async function pingSession(req: express.Request, res: express.Response, next: express.NextFunction) {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    const session = application.sessionManager.getSession(sessionId);
    if (session && session.isValid) {
        await session.ping();
        res.cookie(COOKIE_SESSION_ID, session.id, {
            expires: session.expires
        });
    }
    next();
}

export function requirePermission(permission: Permissions): express.Handler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const sessionId = req.cookies[COOKIE_SESSION_ID];
        if (application.sessionManager.hasPermission(permission, sessionId)) {
            next();
        }
        else {
            res.sendStatus(403);
        }
    }
}