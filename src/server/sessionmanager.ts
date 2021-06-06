import { application } from "../application";
import { randomHex } from "../utils/hex";
import { Logger } from "../utils/logger";
import { verify } from "../utils/password";

const log = new Logger("SessionManager");

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD_KEY = "server.admin.password";
export const SESSION_LENGTH_KEY = "server.admin.sessionLength";
const SESSION_LENGTH_DEFAULT = 90; // Days
const SESSION_ID_LENGTH = 16;

export enum Permissions {
    SERVER_CONTROL = "SERVER_CONTROL",
    SERVER_UPDATE = "SERVER_UPDATE",
    SERVER_CONFIG = "SERVER_CONFIG",
    TRAIN_EDIT = "TRAIN_EDIT",
    TRAIN_SELECT = "TRAIN_SELECT"
}

export const ROLES: { [key: string]: string[] } = {
    "SERVER_ADMIN": [ Permissions.SERVER_CONTROL, Permissions.SERVER_UPDATE, Permissions.SERVER_CONFIG ],
    "TRAIN_ADMIN": [ Permissions.TRAIN_EDIT, Permissions.TRAIN_SELECT ],
    "GUEST": []
};

function getExpireDate(): Date {
    const expire = new Date();
    expire.setDate(
        expire.getDate() + application.config.getAs<number>(SESSION_LENGTH_KEY, SESSION_LENGTH_DEFAULT)
    )
    return expire;
}

export class Session {
    readonly id: string;
    readonly roles = new Set<string>();
    readonly permissions = new Set<string>();

    private _expires: Date;
    public get expires() {
        return this._expires;
    }

    public get isValid(): boolean {
        return new Date() < this._expires;
    }

    constructor() {
        this.id = randomHex(SESSION_ID_LENGTH);
        this.ping();
    }

    ping(): Promise<void> {
        log.verbose(() => { return "Pinging session " + this.id; });
        this._expires = getExpireDate();
        return Promise.resolve();
    }

    addRole(roleName: string) {
        log.verbose(() => { return "Adding role " + roleName + " to session " + this.id; });
        for (const permission of ROLES[roleName])
            this.permissions.add(permission);
        this.roles.add(roleName);
    }

    expire(): Promise<void> {
        log.info(() => { return "Expiring session " + this.id; })
        this._expires = new Date(0);
        return Promise.resolve();
    }
}

const INVALID_CREDENTIALS_ERROR = "Invalid username or password"
const NULL_SESSION_ID_ERROR = "Null session id"
const GUEST_SESSION = new Session();
GUEST_SESSION.addRole("GUEST");

export class SessionManager {
    private readonly _sessions: Map<string, Session> = new Map();
    
    async signIn(username: string, password: string): Promise<Session> {
        if (username != ADMIN_USERNAME) {
            log.warning("Attempt to login with username '" + username + "'");
            throw new Error(INVALID_CREDENTIALS_ERROR);
        }
        if (!password) {
            log.error("Null password provided");
            throw new Error(INVALID_CREDENTIALS_ERROR);
        }

        const phash = application.config.getAs<string>(ADMIN_PASSWORD_KEY);
        if (!phash) {
            log.error("No password has been configured");
            throw new Error(INVALID_CREDENTIALS_ERROR);
        }

        log.info(() => { return "Attemping to login user '" + username + "'"; });
        if (await verify(password, phash) == false) {
            log.warning("Failed to authenticate '" + username + "'");
            throw new Error(INVALID_CREDENTIALS_ERROR);
        }

        const session = new Session();
        log.info(() => { return "User '" + username + "' authenticated with session " + session.id; });

        for (let role in ROLES) {
            session.addRole(role);
        }

        this._sessions.set(session.id, session);

        return session;
    }

    async getAndPingSession(id: string): Promise<Session> {
        if (!id) throw new Error(NULL_SESSION_ID_ERROR);

        let session = this._sessions.get(id) ?? GUEST_SESSION;
        if (!session.isValid) {
            session = GUEST_SESSION;
        }
        await session.ping();

        return session;
    }
}
