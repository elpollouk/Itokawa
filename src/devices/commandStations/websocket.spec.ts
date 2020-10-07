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

    function open(connectionString = CONNECTION_STRING) {
        const promise = WebSocketCommandStation.open(CONNECTION_STRING);
        webSocketMock.emit("open");
        return promise;
    }

    describe("open", () => {
        it("should establish a connection", async () => {
            const cs = await open();
            expect(createSocketStub.callCount).to.equal(1);
            expect(createSocketStub.lastCall.args).to.eql(["wss://foo/bar"]);
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("should be rejected if no URL provided", async () => {
            await expect(WebSocketCommandStation.open("foo=bar")).to.be.rejectedWith('"url" not specified in connection string');
            expect(createSocketStub.callCount).to.equal(0);
        })

        it("should be rejected if there is an error connecting", async () => {
            const promise = WebSocketCommandStation.open(CONNECTION_STRING);

            webSocketMock.emit("error", new Error("Test Error"));

            await expect(promise).to.be.rejectedWith("Test Error");
        })

        it("should be rejected if the socket is closed unexpectedly", async () => {
            const promise = WebSocketCommandStation.open(CONNECTION_STRING);

            webSocketMock.emit("close", -1, "Test Close");

            await expect(promise).to.be.rejectedWith("WebSocket closed unexpectedly. Reason: Test Close");
        })
    })
})