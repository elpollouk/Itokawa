import { application } from "../application";
import { verify } from "../utils/password";

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD_KEY = "server.admin.password";
export const SESSION_LENGTH_KEY = "server.admin.sessionLength";
const SESSION_LENGTH_DEFAULT = 90; // Days

export enum Permissions {
    SERVER_CONTROL = "SERVER_CONTROL",
    SERVER_UPDATE = "SERVER_UPDATE",
    SERVER_CONFIG = "SERVER_CONFIG",
    TRAIN_EDIT = "TRAIN_EDIT",
    TRAIN_SELECT = "TRAIN_SELECT"
}

const ROLES: { [key: string]: string[]} = {
    "SERVER_ADMIN": [ Permissions.SERVER_CONTROL, Permissions.SERVER_UPDATE, Permissions.SERVER_CONFIG ],
    "TRAIN_ADMIN": [ Permissions.TRAIN_EDIT, Permissions.TRAIN_SELECT ],
    "GUEST": []
};

export function getExpireDate(): Date {
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
        return !!this._expires && new Date() < this._expires;
    }

    constructor() {
        this.id = "";
        this.ping();
    }

    ping() {
        this._expires = getExpireDate();
    }

    addRole(roleName: string) {

    }

    expire() {
        this._expires = null;
    }
}

const INVALID_CREDENTIALS_ERROR = "Invalid username or password"

export class SessionManager {
    private readonly _sessions: Map<string, Session> = new Map();
    
    async signIn(username: string, password: string): Promise<Session> {
        if (username != ADMIN_USERNAME) return Promise.reject(new Error(INVALID_CREDENTIALS_ERROR));
        const phash = application.config.getAs<string>(ADMIN_PASSWORD_KEY);
        if (await verify(password, phash) == false) return Promise.reject(new Error(INVALID_CREDENTIALS_ERROR));

        const session = new Session();

        for (let role in ROLES) {
            session.addRole(role);
        }

        return session;
    }

    getSession(id: string): Session {
        return this._sessions.get(id);
    }
}