import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon"
import { nextTick } from "../../utils/promiseUtils"
import * as messages from "../../common/messages";
import { timestamp } from "../../common/time";
import { WebSocketCommandStation } from "./websocket"
import * as WebSocket from "ws";
import { CommandStationState } from "./commandStation";

const CONNECTION_STRING = "url=wss://foo/bar";

class WebSocketMock {
    callbacks:{[key: string]: (...args: any[])  => void } = {}
    sentData: any[] = [];
    lastTag: string = null;
    close = stub();

    on(event: string, func: (...args: any[])  => void) {
        this.callbacks[event] = func
    }

    emit(event: string, ...args: any[]) {
        this.callbacks[event](...args);
    }

    send(data: string) {
        const message = JSON.parse(data) as messages.TransportMessage;
        this.lastTag = message.tag;
        this.sentData.push(message);
    }

    postResponse<T>(tag: string, data: T) {
        const message: messages.TransportMessage = {
            type: messages.RequestType.CommandResponse,
            tag: tag,
            requestTime: timestamp(),
            data: {
                lastMessage: false,
                data: data
            }
        };
        this.emit("message", JSON.stringify(message));
    }

    postOk(tag: string) {
        const message: messages.TransportMessage = {
            type: messages.RequestType.CommandResponse,
            tag: tag,
            requestTime: timestamp(),
            data: {
                lastMessage: true,
                data: "OK"
            }
        };
        this.emit("message", JSON.stringify(message));
    }

    postError(tag: string, error: string) {
        const message: messages.TransportMessage = {
            type: messages.RequestType.CommandResponse,
            tag: tag,
            requestTime: timestamp(),
            data: {
                lastMessage: true,
                error: error
            }
        };
        this.emit("message", JSON.stringify(message));
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

        it("should raise an exception if the service is not listening", async () => {
            restore();
            await expect(WebSocketCommandStation.open("url=ws://127.0.0.1:0/")).to.be.rejectedWith(/EADDRNOTAVAIL/);
        })
    })

    describe("close", () => {
        it("waits until close event fired", async () => {
            const cs = await open();

            const promise = cs.close();
            webSocketMock.emit("close", 0, "Closed");
            await promise;

            expect(webSocketMock.close.callCount).to.equal(1);
            expect(webSocketMock.close.lastCall.args).to.eql([]);
        })
    })

    describe("readLocoCv", () => {
        it("issues request for CV and returns value", async () => {
            const cv = 123;
            const cvValue = 17;

            const cs = await open();
            const promise = cs.readLocoCv(cv);
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.BUSY);
            expect(webSocketMock.sentData).to.have.length(1);
            const request = webSocketMock.sentData[0] as messages.TransportMessage;
            expect(request.type).to.equal(messages.RequestType.LocoCvRead);
            expect(request.requestTime).to.be.a("string").and.not.be.empty;
            expect(request.tag).to.be.a("string").and.not.be.empty;
            expect(request.data).to.eql({
                cvs: [cv]
            });

            webSocketMock.postResponse<messages.CvValuePair>(request.tag, {
                cv: cv,
                value: cvValue
            });
            webSocketMock.postOk(request.tag);

            expect(await promise).to.equal(cvValue);
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("ignores incorrect tags during request", async () => {
            const cv = 84;
            const cvValue = 55;

            const cs = await open();
            const promise = cs.readLocoCv(cv);
            await nextTick();

            webSocketMock.postResponse<messages.CvValuePair>(webSocketMock.lastTag, {
                cv: cv,
                value: cvValue
            });
            webSocketMock.postResponse<messages.CvValuePair>("Bad Tag", {
                cv: cv,
                value: 0
            });
            webSocketMock.postOk(webSocketMock.lastTag);

            expect(await promise).to.equal(cvValue);
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception for invalid CV numbers", async () => {
            const cs = await open();
            await expect(cs.readLocoCv(-1)).to.be.rejectedWith("CV -1 outside of valid range");
            await expect(cs.readLocoCv(0)).to.be.rejectedWith("CV 0 outside of valid range");
            await expect(cs.readLocoCv(256)).to.be.rejectedWith("CV 256 outside of valid range");
            await expect(cs.readLocoCv(257)).to.be.rejectedWith("CV 257 outside of valid range");
        })

        it("raises exception for incorrect CV value returned", async () => {
            const cs = await open();
            const promise = cs.readLocoCv(12);
            await nextTick();
            const tag = webSocketMock.lastTag;

            webSocketMock.postResponse<messages.CvValuePair>(tag, {
                cv: 2,
                value: 1
            });
            webSocketMock.postOk(tag);

            await expect(promise).to.be.rejectedWith("No CV data returned");
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception if no CV data received", async () => {
            const cs = await open();
            const promise = cs.readLocoCv(12);
            await nextTick();
            webSocketMock.postOk(webSocketMock.lastTag);

            await expect(promise).to.be.rejectedWith("No CV data returned");
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception if error returned by service", async () => {
            const cs = await open();
            const promise = cs.readLocoCv(12);
            await nextTick();
            webSocketMock.postError(webSocketMock.lastTag, "Test Error");

            await expect(promise).to.be.rejectedWith("Test Error");
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception if there is an underlying socket exception", async () => {
            const cs = await open();
            const promise = cs.readLocoCv(12);
            await nextTick();
            webSocketMock.emit("error", new Error("Socket Error"));

            await expect(promise).to.be.rejectedWith("Socket Error");
            expect(cs.state).to.equal(CommandStationState.ERROR);
        })
    })

    describe("writeLocoCv", () => {
        it("issues a valid write CV request", async () => {
            const cv = 32;
            const cvValue = 20;

            const cs = await open();
            const promise = cs.writeLocoCv(cv, cvValue);
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.BUSY);
            expect(webSocketMock.sentData).to.have.length(1);
            const request = webSocketMock.sentData[0] as messages.TransportMessage;
            expect(request.type).to.equal(messages.RequestType.LocoCvWrite);
            expect(request.requestTime).to.be.a("string").and.not.be.empty;
            expect(request.tag).to.be.a("string").and.not.be.empty;
            expect(request.data).to.eql({
                cvs: [{
                    cv: cv,
                    value: cvValue
                }]
            });

            webSocketMock.postResponse<messages.CvValuePair>(request.tag, {
                cv: cv,
                value: cvValue
            });
            webSocketMock.postOk(request.tag);

            await promise;
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception for invalid CV numbers", async () => {
            const cs = await open();
            await expect(cs.writeLocoCv(-1, 0)).to.be.rejectedWith("CV -1 outside of valid range");
            await expect(cs.writeLocoCv(0, 0)).to.be.rejectedWith("CV 0 outside of valid range");
            await expect(cs.writeLocoCv(256, 0)).to.be.rejectedWith("CV 256 outside of valid range");
            await expect(cs.writeLocoCv(257, 0)).to.be.rejectedWith("CV 257 outside of valid range");
        })

        it("raises exception for invalid CV values", async () => {
            const cs = await open();
            await expect(cs.writeLocoCv(29, -1)).to.be.rejectedWith("Byte(-1) outside of valid range");
            await expect(cs.writeLocoCv(30, 256)).to.be.rejectedWith("Byte(256) outside of valid range");
        })

        it("raises exception if error returned by service", async () => {
            const cs = await open();
            const promise = cs.writeLocoCv(12, 0);
            await nextTick();
            webSocketMock.postError(webSocketMock.lastTag, "Service Error");

            await expect(promise).to.be.rejectedWith("Service Error");
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("raises exception if there is an underlying socket exception", async () => {
            const cs = await open();
            const promise = cs.writeLocoCv(12, 1);
            await nextTick();
            webSocketMock.emit("error", new Error("Socket Error"));

            await expect(promise).to.be.rejectedWith("Socket Error");
            expect(cs.state).to.equal(CommandStationState.ERROR);
        })
    })

    describe("Received message handling", () => {
        it("safely ignores irrelevate messages", async () => {
            const cs = await open();

            webSocketMock.postResponse<string>("foo", "bar");
            await nextTick();
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("to ignore malformed messages", async () => {
            const cs = await open();

            webSocketMock.emit("message", "dasgsdgs");
            await nextTick();
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
        })
    })
})