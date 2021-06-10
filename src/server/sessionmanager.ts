import { application } from "../application";
import { Database } from "../model/database";
import { Statement } from "../model/statement";
import { randomHex } from "../utils/hex";
import { Logger } from "../utils/logger";
import { verify } from "../utils/password";

const log = new Logger("SessionManager");

export const ADMIN_USERNAME_KEY = "server.admin.username";
export const ADMIN_PASSWORD_KEY = "server.admin.password";
export const SESSION_LENGTH_KEY = "server.admin.sessionLength";
// Custom user ids for built in accounts
export const USERID_ADMIN = -101
export const USERID_GUEST = -102

const DEFAULT_ADMIN_USERNAME = "admin";
const SESSION_LENGTH_DEFAULT = 90; // Days
const SESSION_ID_LENGTH = 16; // Characters
const MAX_DATE = new Date(8640000000000000);
const MIN_QUERY_TIME = 10000; // Milliseconds

// Error messages
const ERROR_INVALID_CREDENTIALS = "Invalid username or password"
const ERROR_NULL_SESSION_ID = "Null session id"
const ERROR_GUEST_EXPIRE = "Attempt to expire guest session";
const ERROR_GUEST_ADDROLE = "Attempt to modify guest permissions";

export enum Permissions {
    SERVER_CONTROL = "SERVER_CONTROL",
    SERVER_UPDATE = "SERVER_UPDATE",
    SERVER_CONFIG = "SERVER_CONFIG",
    APP_UPDATE = "APP_UPDATE",
    SESSION_MANAGE = "SESSION_MANAGE",
    TRAIN_EDIT = "TRAIN_EDIT",
    TRAIN_SELECT = "TRAIN_SELECT"
}

export const ROLES: { [key: string]: string[] } = {
    "SERVER_ADMIN": [ Permissions.SERVER_CONTROL, Permissions.SERVER_UPDATE, Permissions.APP_UPDATE, Permissions.SERVER_CONFIG ],
    "USER_ADMIN": [ Permissions.SESSION_MANAGE ],
    "TRAIN_ADMIN": [ Permissions.TRAIN_EDIT, Permissions.TRAIN_SELECT ]
};

let _dbPing: Statement<void> = null;
let _dbFetch: Statement<Session> = null;
let _dbDelete: Statement<void> = null;
let _dbDeleteExpired: Statement<void> = null;
let _dbDeleteAll: Statement<void> = null;

type QueryFunc = (params?:any)=>Promise<void>;

function debouceQuery(query: QueryFunc, minTime: number): QueryFunc {
    let lastCall = 0;
    return (_params) => {
        const now = new Date().getTime();
        const delta = now - lastCall;
        if (delta >= minTime) {
            lastCall = now;
            return query(_params);
        }
        return Promise.resolve();
    }
}

function getExpireDate(): Date {
    const expire = new Date();
    expire.setDate(
        expire.getDate() + application.config.getAs<number>(SESSION_LENGTH_KEY, SESSION_LENGTH_DEFAULT)
    )
    return expire;
}

export class Session {
    readonly id: string;
    readonly userId: number
    readonly roles = new Set<string>();
    readonly permissions = new Set<string>();
    private readonly _ping: QueryFunc;

    protected _expires: Date;
    get expires() {
        return this._expires;
    }

    get isValid(): boolean {
        return new Date() < this._expires;
    }

    constructor(userId: number, sessionId?: string) {
        this._ping = debouceQuery((params) => _dbPing.run(params), MIN_QUERY_TIME);

        this.id = sessionId ?? randomHex(SESSION_ID_LENGTH);
        this.userId = userId;
        this.ping();
    }

    ping(): Promise<void> {
        log.verbose(() => `Pinging session ${this.id}`);
        this._expires = getExpireDate();
        return this._ping({
            $id: this.id,
            $userId: this.userId,
            $expires: this._expires.getTime()
        });
    }

    addRole(roleName: string) {
        log.verbose(() => `Adding role ${roleName} to session ${this.id}`);
        for (const permission of ROLES[roleName])
            this.permissions.add(permission);
        this.roles.add(roleName);
    }

    expire(): Promise<void> {
        if (!this.isValid) return;
        log.info(() => `Expiring session ${this.id}`)
        this._expires = new Date(0);
        return _dbDelete.run({
            $id: this.id
        })
    }
}

class GuestSession extends Session {
    constructor() {
        super(USERID_GUEST);
        this._expires = MAX_DATE;
        this.roles.add("GUEST");

        // If no admin password has been configured, then guests need all permissions, an admin party!
        const phash = application.config.getAs<string>(ADMIN_PASSWORD_KEY);
        if (!phash) {
            for (const permission in Permissions) {
                this.permissions.add(permission);
            }
        }
    }

    ping(): Promise<void> {
        return Promise.resolve();
    }

    addRole(_roleName: string) {
        throw new Error(ERROR_GUEST_ADDROLE);
    }

    expire(): Promise<void> {
        return Promise.reject(new Error(ERROR_GUEST_EXPIRE));
    }
}

class AdminSession extends Session {
    constructor(userId: number, sessionId?: string) {
        super(userId, sessionId);
        for (let role in ROLES) {
            this.addRole(role);
        }
    }
}

export class SessionManager {
    private readonly _sessions: Map<string, Session> = new Map();

    async init(db: Database): Promise<void> {
        _dbPing = await db.prepare(`
            INSERT INTO user_sessions ( id, userId, expires )
            VALUES ( $id, $userId, $expires )
            ON CONFLICT ( id )
            DO UPDATE SET expires = $expires;
        `);

        _dbFetch = await db.prepare(`
            SELECT * FROM user_sessions WHERE id = $id;
        `);

        _dbDelete = await db.prepare(`
            DELETE FROM user_sessions WHERE id = $id;
        `);

        _dbDeleteExpired = await db.prepare(`
            DELETE FROM user_sessions WHERE expires < $now;
        `);

        _dbDeleteAll = await db.prepare(`
            DELETE FROM user_sessions;
        `);
    }

    async shutdown(): Promise<void> {
        if (_dbPing) {
            await _dbPing.release();
            _dbPing = null;
            await _dbFetch.release();
            _dbFetch = null;
            await _dbDelete.release();
            _dbDelete = null;
            await _dbDeleteExpired.release();
            _dbDeleteExpired = null;
            await _dbDeleteAll.release();
            _dbDeleteAll = null;
        }
    }
    
    async signIn(username: string, password: string): Promise<Session> {
        if (username != application.config.getAs<string>(ADMIN_USERNAME_KEY, DEFAULT_ADMIN_USERNAME)) {
            log.warning(`Attempt to login with username '${username}'`);
            throw new Error(ERROR_INVALID_CREDENTIALS);
        }
        if (!password) {
            log.error("Null password provided");
            throw new Error(ERROR_INVALID_CREDENTIALS);
        }

        const phash = application.config.getAs<string>(ADMIN_PASSWORD_KEY);
        if (!phash) {
            log.error("No password has been configured");
            throw new Error(ERROR_INVALID_CREDENTIALS);
        }

        log.info(() => `Attemping to login user '${username}'`);
        if (await verify(password, phash) == false) {
            log.warning(`Failed to authenticate '${username}'`);
            throw new Error(ERROR_INVALID_CREDENTIALS);
        }

        const session = new AdminSession(USERID_ADMIN);
        this._sessions.set(session.id, session);
        log.info(() => `User '${username}' authenticated with session ${session.id}`);

        return session;
    }

    async signOut(sessionId: string): Promise<void> {
        log.info(() => `Attempting to sign out session ${sessionId}`);
        if (!sessionId) throw new Error(ERROR_NULL_SESSION_ID);

        const session = this._sessions.get(sessionId);
        if (session) {
            this._sessions.delete(session.id);
            await session.expire();
        }
        else {
            log.info("Session not cached");
            await _dbDelete.run({
                $id: sessionId
            });
        }
        log.info("Session signed out");
    }

    getSession(id: string): Promise<Session> {
        let session = this._sessions.get(id) ?? null;
        if (!session) {
            return _dbFetch.get({
                $id: id
            }, (row) => {
                if (!row) return null;
                session = new AdminSession(row.userId, row.id);
                this._sessions.set(session.id, session);
                return session;
            });
        }
        return Promise.resolve(session);
    }

    async getAndPingSession(id: string): Promise<Session> {
        let session = await this.getSession(id);
        if (!session?.isValid) {
            return new GuestSession();
        }
        await session.ping();
        return session;
    }

    async ping(sessionId: string): Promise<boolean> {
        // If no admin has been configured, every one is an admin
        if (!application.config.get(ADMIN_PASSWORD_KEY)) return true;

        const session = await this.getSession(sessionId);
        if (!session?.isValid) {
            return false;
        }
        await session.ping();
        return true;
    }

    getCachedSessions(): IterableIterator<Session> {
        return this._sessions.values();
    }

    clearExpired(): Promise<void> {
        log.info("Checking for expired sessions...");
        const toRemove: string[] = [];
        for (const session of this._sessions.values()) {
            if (!session.isValid) {
                toRemove.push(session.id);
            }
        }

        log.info(() => `Removing ${toRemove.length} sessions`);
        for (const id of toRemove) {
            this._sessions.delete(id);
        }

        return _dbDeleteExpired.run({
            $now: new Date().getTime()
        })
    }

    clearAll(): Promise<void> {
        this._sessions.clear();
        return _dbDeleteAll.run();
    }

    async hasPermission(permission: Permissions, sessionId: string): Promise<boolean> {
        const session = await this.getSession(sessionId) ?? new GuestSession();
        return session.isValid ? session.permissions.has(permission) : false;
    }
}
