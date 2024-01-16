import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon";

import * as ws from "ws";
import * as lifecycleHandler from "./lifecycle";
import * as locoHandler from "./loco";
import * as cvHandler from "./cv";
import { ok, resetHandler, getControlWebSocketRoute, HandlerMap, clientBroadcast, ConnectionContext } from "./handlers";
import { RequestType, CommandResponse } from "../../common/messages";
import { Permissions } from "../sessionmanager";
import { application } from "../../application";

class MockWebSocket extends ws {
    send = stub();
    eventHandlers = new Map<string, Function>();

    constructor(readyState: number = 1) {
        // This awefulness is needed when type definitions aren't kept up to date with the actual library
        super(null as any, null as any, { autoPong: false} as any);
        Object.defineProperties(this, {
            on: {
                value: (event: string, cb: Function) => this.eventHandlers[event] = cb
            },
            readyState: {
                value: readyState
            }
        });
    }
}

function connectSocket(route: Function, readyState: number = 1): MockWebSocket {
    const socket = new MockWebSocket(readyState);
    route(socket, {cookies:{}}, stub());
    return socket;
}

function connectSocketWithSessionId(route: Function, sessionId: string): MockWebSocket {
    const socket = new MockWebSocket(1);
    route(socket, {cookies:{sessionId:sessionId}}, stub());
    return socket;
}

describe("WebSocket Handlers", () => {
    let lifeCycleRegisterStub: SinonStub;
    let lifeCycleHanderStub: SinonStub;
    let locoRegisterStub: SinonStub;
    let locoHandlerStub: SinonStub;
    let cvRegisterStub: SinonStub;

    beforeEach(() => {
        resetHandler();
        lifeCycleHanderStub = stub().returns(Promise.resolve());
        lifeCycleRegisterStub = stub(lifecycleHandler, "registerHandlers").callsFake((map: HandlerMap) => {
            map.set(RequestType.LifeCycle, lifeCycleHanderStub);
        });
        locoHandlerStub = stub().returns(Promise.resolve());
        locoRegisterStub = stub(locoHandler, "registerHandlers").callsFake((map: HandlerMap) => {
            map.set(RequestType.LocoSpeed, locoHandlerStub);
        });
        cvRegisterStub = stub(cvHandler, "registerHandlers");
    })

    afterEach(() => {
        restore();
    })

    describe("ok", () => {
        it("should send an ok message", async () => {
            const sender = stub().returns(Promise.resolve());
            await ok(sender);
            expect(sender.callCount).to.equal(1);
            expect(sender.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })
    })

    describe("getControlWebSocketRoute", () => {
        it("should register required handlers", () => {
            const route = getControlWebSocketRoute();
            expect(route).to.be.instanceOf(Function);
            expect(lifeCycleRegisterStub.callCount).to.equal(1);
            expect(locoRegisterStub.callCount).to.equal(1);
            expect(cvRegisterStub.callCount).to.equal(1);
        })

        it("should route messages through to the correct handler", async () => {
            const route = getControlWebSocketRoute();
            const ws = connectSocket(route);

            await ws.eventHandlers["message"]('{"type":2,"data":"foo"}');
            expect(locoHandlerStub.callCount).to.equal(1);
            expect(locoHandlerStub.lastCall.args[1]).to.equal("foo");

            await ws.eventHandlers["message"]('{"type":1,"data":"bar"}');
            expect(lifeCycleHanderStub.callCount).to.equal(1);
            expect(lifeCycleHanderStub.lastCall.args[1]).to.equal("bar");
        })

        it("should ping session", async () => {
            const pingStub = stub(application.sessionManager, "ping").resolves(true);
            const route = getControlWebSocketRoute();
            const ws = connectSocketWithSessionId(route, "test_session");

            await ws.eventHandlers["message"]('{"type":2}');
            expect(pingStub.callCount).to.equal(1);
            expect(pingStub.lastCall.args).to.eql(["test_session"]);
        })

        it("should ignore unregistered handler types", async () => {
            const route = getControlWebSocketRoute();
            const ws = new MockWebSocket();
            route(ws as any, {cookies:{}} as any, () => {});

            await ws.eventHandlers["message"]('{"type":0,"data":"foo"}');
        })

        it("should ignore malformed requests", async () => {
            const route = getControlWebSocketRoute();
            const ws = connectSocket(route);

            await ws.eventHandlers["message"]('INVALID');
        })

        it("should handle errors from handlers", async () => {
            locoHandlerStub.throws(new Error("Test Error"));
            const route = getControlWebSocketRoute();
            const socket = connectSocket(route);

            await socket.eventHandlers["message"]('{"type":2,"data":"foo"}');
            expect(socket.send.callCount).to.equal(1);
            const message = JSON.parse(socket.send.lastCall.args[0]);
            expect(message.type).to.equal(RequestType.CommandResponse);
            expect(message.data.lastMessage).to.be.true;
            expect(message.data.error).to.equal("Test Error");
        })
    })

    describe("ConnectionContext", () => {
        it("should pass session id in connection context", async () => {
            const route = getControlWebSocketRoute();
            const ws = connectSocketWithSessionId(route, "test_session");

            await ws.eventHandlers["message"]('{"type":2}');

            expect(locoHandlerStub.lastCall.args[0].sessionId).to.eql("test_session");
        })

        it("should report isSignedIn true if the session is valid", async () => {
            const pingStub = stub(application.sessionManager, "ping").resolves(true);
            const route = getControlWebSocketRoute();
            const ws = connectSocketWithSessionId(route, "test_session");

            await ws.eventHandlers["message"]('{"type":2}');

            expect(locoHandlerStub.lastCall.args[0].isSignedIn).to.be.true;
        })

        it("should report isSignedIn false if the session isn't valid", async () => {
            const pingStub = stub(application.sessionManager, "ping").resolves(false);
            const route = getControlWebSocketRoute();
            const ws = connectSocketWithSessionId(route, "test_session");

            await ws.eventHandlers["message"]('{"type":2}');

            expect(locoHandlerStub.lastCall.args[0].isSignedIn).to.be.false;
        })

        describe("hasPermission", () => {
            it("should return true if session has permission", async () => {
                const hasPermissionStub = stub(application.sessionManager, "hasPermission").resolves(true);
                const route = getControlWebSocketRoute();
                const ws = connectSocketWithSessionId(route, "test_session");

                await ws.eventHandlers["message"]('{"type":2}');

                const context: ConnectionContext = locoHandlerStub.lastCall.args[0];
                expect(await context.hasPermission(Permissions.SERVER_UPDATE)).to.be.true
                expect(hasPermissionStub.callCount).to.equal(1);
                expect(hasPermissionStub.lastCall.args).to.eql([Permissions.SERVER_UPDATE, "test_session"]);
            })

            it("should return false if session doesn't have permission", async () => {
                const hasPermissionStub = stub(application.sessionManager, "hasPermission").resolves(false);
                const route = getControlWebSocketRoute();
                const ws = connectSocketWithSessionId(route, "test_session");

                await ws.eventHandlers["message"]('{"type":2}');

                const context: ConnectionContext = locoHandlerStub.lastCall.args[0];
                expect(await context.hasPermission(Permissions.TRAIN_EDIT)).to.be.false
                expect(hasPermissionStub.callCount).to.equal(1);
                expect(hasPermissionStub.lastCall.args).to.eql([Permissions.TRAIN_EDIT, "test_session"]);
            })
        })

        describe("requirePermission", () => {
            it("should not raise exception is permission granted", async () => {
                const hasPermissionStub = stub(application.sessionManager, "hasPermission").resolves(true);
                const route = getControlWebSocketRoute();
                const ws = connectSocketWithSessionId(route, "test_session");

                await ws.eventHandlers["message"]('{"type":2}');

                const context: ConnectionContext = locoHandlerStub.lastCall.args[0];
                context.requirePermission(Permissions.SERVER_UPDATE);
                expect(hasPermissionStub.callCount).to.equal(1);
                expect(hasPermissionStub.lastCall.args).to.eql([Permissions.SERVER_UPDATE, "test_session"]);
            })

            it("should return false if session doesn't have permission", async () => {
                const hasPermissionStub = stub(application.sessionManager, "hasPermission").resolves(false);
                const route = getControlWebSocketRoute();
                const ws = connectSocketWithSessionId(route, "test_session");

                await ws.eventHandlers["message"]('{"type":2}');

                const context: ConnectionContext = locoHandlerStub.lastCall.args[0];
                await expect(context.requirePermission(Permissions.TRAIN_EDIT)).to.be.eventually.rejectedWith("Access denied");
                expect(hasPermissionStub.callCount).to.equal(1);
                expect(hasPermissionStub.lastCall.args).to.eql([Permissions.TRAIN_EDIT, "test_session"]);
            })
        })
    })

    describe("per socket command responder function", () => {
        it("should wrap handler message in transport message", async () => {
            let sent = false;
            locoHandlerStub.callsFake(async (ctx: ConnectionContext, msg: any, send: (data: CommandResponse) => Promise<boolean>): Promise<void> => {
                sent = await send("Test Data" as any);
            });
            const route = getControlWebSocketRoute();            
            const socket = connectSocket(route);

            await socket.eventHandlers["message"]('{"type":2,"data":{},"tag":"client:123"}');

            expect(socket.send.callCount).equal(1);
            expect(sent).to.be.true;
            const message = JSON.parse(socket.send.lastCall.args[0]);
            expect(message.type).to.equal(RequestType.CommandResponse);
            expect(message.data).to.equal("Test Data");
            expect(message.tag).to.equal("client:123");
            expect(message.requestTime).to.not.be.undefined.and.not.be.null.and.not.be.empty;
        })

        it("should not send to unopen sockets", async () => {
            let sent = false;
            locoHandlerStub.callsFake(async (ctx: ConnectionContext, msg: any, send: (data: CommandResponse) => Promise<boolean>): Promise<void> => {
                sent = await send("Test Data" as any);
            });
            const route = getControlWebSocketRoute();            
            const socket = connectSocket(route, 0);

            await socket.eventHandlers["message"]('{"type":2,"data":{},"tag":"client:123"}');

            expect(socket.send.callCount).equal(0);
            expect(sent).to.be.false;
        })
    })

    describe("clientBroadcast", () => {
        it("should broadcast to all connected sockets", async () => {
            const route = getControlWebSocketRoute();            
            const ws1 = connectSocket(route);
            const ws2 = connectSocket(route);

            await clientBroadcast(RequestType.LocoSpeedRefresh, "Foo Bar");

            expect(ws1.send.callCount).to.equal(1);
            expect(ws2.send.callCount).to.equal(1);
            let message = ws1.send.lastCall.args[0];
            expect(ws2.send.lastCall.args[0]).to.equal(message);
            
            message = JSON.parse(message);
            expect(message.type).to.equal(RequestType.LocoSpeedRefresh);
            expect(message.data).to.equal("Foo Bar");
            expect(message.requestTime).to.not.be.undefined.and.not.null.and.not.empty;
            expect(message.tag).to.not.be.undefined.and.not.null.and.not.empty;
        })

        it("should not broadcast to closed socket", async () => {
            const route = getControlWebSocketRoute();            
            const ws1 = connectSocket(route);
            const ws2 = connectSocket(route);
            const ws3 = connectSocket(route);
            ws1.eventHandlers["close"]();

            await clientBroadcast(RequestType.LocoSpeed, "Test");

            expect(ws1.send.callCount).to.equal(0);
            expect(ws2.send.callCount).to.equal(1);
            expect(ws3.send.callCount).to.equal(1);
        })

        it("should not broadcast to excluded socket", async () => {
            const route = getControlWebSocketRoute();            
            const ws1 = connectSocket(route);
            const ws2 = connectSocket(route);
            const ws3 = connectSocket(route);

            await clientBroadcast(RequestType.LocoSpeed, "Test", ws2);

            expect(ws1.send.callCount).to.equal(1);
            expect(ws2.send.callCount).to.equal(0);
            expect(ws3.send.callCount).to.equal(1);
        })

        it("should not broadcast to array of excluded sockets", async () => {
            const route = getControlWebSocketRoute();            
            const ws1 = connectSocket(route);
            const ws2 = connectSocket(route);
            const ws3 = connectSocket(route);

            await clientBroadcast(RequestType.LocoSpeed, "Test", [ws1, ws3]);

            expect(ws1.send.callCount).to.equal(0);
            expect(ws2.send.callCount).to.equal(1);
            expect(ws3.send.callCount).to.equal(0);
        })

        it("should not broadcast to set of excluded sockets", async () => {
            const route = getControlWebSocketRoute();            
            const ws1 = connectSocket(route);
            const ws2 = connectSocket(route);
            const ws3 = connectSocket(route);
            const exclude = new Set<ws>([
                ws2,
                ws3
            ]);

            await clientBroadcast(RequestType.LocoSpeed, "Test", exclude);

            expect(ws1.send.callCount).to.equal(1);
            expect(ws2.send.callCount).to.equal(0);
            expect(ws3.send.callCount).to.equal(0);
        })
    });
})