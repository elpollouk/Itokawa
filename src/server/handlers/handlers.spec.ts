import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";

import * as lifecycleHandler from "./lifecycle";
import * as locoHandler from "./loco";
import { ok, resetHandler, getControlWebSocketRoute, HandlerMap } from "./handlers";
import { Handler } from "express";
import { RequestType } from "../../common/messages";

class MockWebSocket {
    send = stub();
    eventHandlers = new Map<string, Function>();
    on(event: string, cb: Function) {
        this.eventHandlers[event] = cb;
    }
}

describe("WebSocket Handlers", () => {
    let lifeCycleRegisterStub: SinonStub;
    let lifeCycleHanderStub: SinonStub;
    let locoRegisterStub: SinonStub;
    let locoHandlerStub: SinonStub;

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
    })

    afterEach(() => {
        lifeCycleRegisterStub.restore();
        locoRegisterStub.restore();
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
        })

        it("should route messages through to the correct handler", async () => {
            const route = getControlWebSocketRoute();            
            const ws = new MockWebSocket();
            route(ws as any, null, stub());

            await ws.eventHandlers["message"]('{"type":2,"data":"foo"}');
            expect(locoHandlerStub.callCount).to.equal(1);
            expect(locoHandlerStub.lastCall.args[0]).to.equal("foo");

            await ws.eventHandlers["message"]('{"type":1,"data":"bar"}');
            expect(lifeCycleHanderStub.callCount).to.equal(1);
            expect(lifeCycleHanderStub.lastCall.args[0]).to.equal("bar");
        })

        it("should ignore unregistered handler types", async () => {
            const route = getControlWebSocketRoute();            
            const ws = new MockWebSocket();
            route(ws as any, null, stub());

            await ws.eventHandlers["message"]('{"type":0,"data":"foo"}');
        })

        it("should ignore malformed requests", async () => {
            const route = getControlWebSocketRoute();            
            const ws = new MockWebSocket();
            route(ws as any, null, stub());

            await ws.eventHandlers["message"]('INVALID');
        })
    })
})