import * as express from "express";
import { application } from "../../application";
import { COOKIE_SESSION_ID, PATH_MAIN } from "../../common/constants";
import { Logger } from "../../utils/logger";
import { Permissions } from "../sessionmanager";

const log = new Logger("Auth");

const _authRouter = express.Router();
_authRouter.use(express.urlencoded({extended: true}));

//-----------------------------------------------------------------------------------------------//
// User pages
//-----------------------------------------------------------------------------------------------//
_authRouter.route("/")
.get(async (req, res) => {
    const sessionId = req.cookies[COOKIE_SESSION_ID];
    const session = await application.sessionManager.getSession(sessionId);
    if (session && session.isValid) {
        await session.ping();
        res.cookie(COOKIE_SESSION_ID, session.id, {
            expires: session.expires
        }).redirect(PATH_MAIN);
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
        }).redirect(PATH_MAIN);
        log.info(() => `Successfully signed in user '${username}' with session ${session.id}`);
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
    res.clearCookie(COOKIE_SESSION_ID).redirect(PATH_MAIN);
    log.info(() => `Successfully logged out session ${sessionId}`);
});


//-----------------------------------------------------------------------------------------------//
// Management pages
//-----------------------------------------------------------------------------------------------//
_authRouter.use(requirePermission(Permissions.SESSION_MANAGE));
_authRouter.route("/clearAllSessions")
.get(async (_req, res) => {
    log.display("Request to clear all sessions");
    const result = {};
    try {
        await application.sessionManager.clearAll();
        result["message"] = "All sessions cleared.";
        log.display("All sessions cleared successfully");
    }
    catch (err) {
        result["errorMessage"] = err;
        log.error(`Failed to clear all sessions: ${err}`);
    }
    res.render("auth/result", result);
});
_authRouter.route("/clearExpiredSessions")
.get(async (_req, res) => {
    log.info("Request to clear expired sessions");
    const result = {};
    try {
        await application.sessionManager.clearExpired();
        result["message"] = "Expired sessions cleared.";
        log.info("Expired sessions cleared successfully");
    }
    catch (err) {
        result["errorMessage"] = err;
        log.error(`Failed to clear expired sessions: ${err}`);
    }
    res.render("auth/result", result);
});

export async function getRouter(): Promise<express.Router> {
    return _authRouter;
}

// Updates the expiry date for the current request session if it is still valid
export function pingSession(): express.Handler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const sessionId = req.cookies[COOKIE_SESSION_ID];
        const session = await application.sessionManager.getSession(sessionId);
        if (session && session.isValid) {
            await session.ping();
            log.verbose(() => `Successfully pinged session ${sessionId} for path ${req.path}`);
            res.cookie(COOKIE_SESSION_ID, session.id, {
                expires: session.expires
            });
        } else if (sessionId) {
            delete req.cookies[COOKIE_SESSION_ID];
            res.clearCookie(COOKIE_SESSION_ID);
        }
        next();
    }
}

// Enforces permission granted to current request session
export function requirePermission(permission: Permissions): express.Handler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const sessionId = req.cookies[COOKIE_SESSION_ID];
        if (await application.sessionManager.hasPermission(permission, sessionId)) {
            log.verbose(() => `Passed permission '${permission} check for path ${req.path} by session ${sessionId}`);
            next();
        }
        else {
            log.warning(`Rejected permission '${permission} check for path ${req.path} by session ${sessionId}`);
            res.sendStatus(404);
        }
    }
}
