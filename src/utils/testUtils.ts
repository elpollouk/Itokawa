import { createStubInstance, SinonStubbedInstance, StubbableType, SinonStubbedMember, stub } from "sinon"
import * as fs from "fs";
import * as request from "supertest";
import { Express } from "express-serve-static-core";
import { ICommandBatch } from "../devices/commandStations/commandStation";
import { ConnectionContext } from "../server/handlers/handlers";
import { Permissions } from "../server/sessionmanager";

export type StubbedClass<T> = SinonStubbedInstance<T> & T;

export function createSinonStubInstance<T>(
    constructor: StubbableType<T>,
    overrides?: { [K in keyof T]?: SinonStubbedMember<T[K]> },
): StubbedClass<T> {
    const stub = createStubInstance<T>(constructor, overrides);
    return stub as unknown as StubbedClass<T>;
}

export function createStubCommandStation() {
    const commandBatch = {
        setLocomotiveSpeed: stub(),
        setLocomotiveFunction: stub(),
        writeRaw: stub(),
        commit: stub().returns(Promise.resolve())
    } as ICommandBatch;

    return {
        lastCommandBatch: commandBatch,
        beginCommandBatch: stub().returns(Promise.resolve(commandBatch))
    };
}

export function createMockConnectionContext(): ConnectionContext {
    return {
        sessionId: "mock_session_id",
        isSignedIn: true,
        hasPermission: stub().resolves(true),
        requirePermission: stub().resolves()
    }
}

export function removePermission(context: ConnectionContext, permission: string) {
    context.hasPermission = async (p: Permissions) => p != permission;
    context.requirePermission = async (p: Permissions) => { if (! await context.hasPermission(p)) throw new Error("Access Denied"); };

    // This is is just to satify code coverage
    context.requirePermission(null);
}

//-----------------------------------------------------------------------------------------------//
// File system helpers
//-----------------------------------------------------------------------------------------------//
export function rmFile(path: string) {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
}

export function rmDir(path: string) {
    if (fs.existsSync(path)) {
        if (fs.rmSync) {
            fs.rmSync(path, { recursive: true, force: true });
        }
        else {
            fs.rmdirSync(path, { recursive: true });
        }
    }
}

export function cleanDir(path: string) {
    rmDir(path);
    fs.mkdirSync(path);
}

//-----------------------------------------------------------------------------------------------//
// Request helpers
//-----------------------------------------------------------------------------------------------//
export interface RequestOptions {
    expectRedirectTo?: string,
    sessionId?: string,
    filename?: string,
    filedata?: Buffer,
    formdata?: {[key:string]:string},
    json?: any
}

export async function requestGet(app: Express, path: string, options?: RequestOptions) : Promise<request.Response> {
    options = options ?? {};

    const req = request(app).get(path);

    if (options.sessionId) {
        req.set("Cookie", [`sessionId=${options.sessionId}`]);
    }

    if (options.expectRedirectTo) {
        req.expect(302).expect("Location", options.expectRedirectTo);
    }
    else {
        req.expect(200);
    }

    return req;
}

export async function requestPost(app: Express, path: string, options?: RequestOptions): Promise<request.Response> {
    const req = request(app)
        .post(path);

    if (options.sessionId) {
        req.set("Cookie", [`sessionId=${options.sessionId}`]);
    }

    if (options.filename && options.filedata) {
        req.attach("file", options.filedata, options.filename);
    }
    else if (options.formdata) {
        const body = [];
        for (const key in options.formdata) {
            const value = options.formdata[key];
            if (value !== null)
                body.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
        req.send(body.join("&"));
    }
    else if (options.json) {
        req.set("content-type", "application/json; charset=utf-8").send(JSON.stringify(options.json));
    }

    if (options.expectRedirectTo) {
        req.expect(302).expect("Location", options.expectRedirectTo);
    }
    else {
        req.expect(200);
    }

    return req;
}

export async function requestDelete(app: Express, path: string, options?: RequestOptions): Promise<request.Response> {
    const req = request(app)
        .delete(path);

    if (options.sessionId) {
        req.set("Cookie", [`sessionId=${options.sessionId}`]);
    }

    if (options.expectRedirectTo) {
        req.expect(302).expect("Location", options.expectRedirectTo);
    }
    else {
        req.expect(200);
    }

    return req;
}
