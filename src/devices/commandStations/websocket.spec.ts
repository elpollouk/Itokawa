import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon"
import { WebSocketCommandStation } from "./websocket"
import * as WebSocket from "ws";
import { CommandStationState } from "./commandStation";

const CONNECTION_STRING = "url=wss://foo/bar";

class WebSocketMock {
    callbacks:{[key: string]: (...args: any[])  => void } = {}

    on(event: string, func: (...args: any[])  => void) {
        this.callbacks[event] = func
    }

    emit(event: string, ...args: any[]) {
        this.callbacks[event](...args);
    }
}

describe("WebSocket Command Station", () => {
    let createSocketStub: SinonStub = null;
    let webSocketMock: WebSocketMock = null;

    beforeEach(() => {
        webSocketMock = new WebSocketMock();
        createSocketStub = stub(WebSocketCommandStation, "createSocket").returns(webSocketMock as unknown as WebSocket);
    })

    afterEach(() => {
        restore();
    })

    describe("open", () => {
        it("should establish a connection", async () => {
            const promise = WebSocketCommandStation.open(CONNECTION_STRING);
            expect(createSocketStub.callCount).to.equal(1);
            expect(createSocketStub.lastCall.args).to.eql(["wss://foo/bar"]);

            webSocketMock.emit("open");

            const cs = await promise;
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })
    })
})