import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon"
import { nextTick } from "../../utils/promiseUtils"
import * as messages from "../../common/messages";
import { timestamp } from "../../common/time";
import { WebSocketCommandBatch, WebSocketCommandStation } from "./websocket"
import * as WebSocket from "ws";
import { CommandStationState, FunctionAction, ICommandStation } from "./commandStation";

const CONNECTION_STRING = "url=wss://localhost/control/v1";

class WebSocketMock {
    callbacks:{[key: string]: (...args: any[])  => void } = {}
    sentData: messages.TransportMessage[] = [];
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

    postOk(tag?: string) {
        tag = tag || this.lastTag;
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

    function close(commandStation: ICommandStation) {
        const promise = commandStation.close();
        webSocketMock.emit("close", 0, "closed");
        return promise;
    }

    describe("open", () => {
        it("should establish a connection", async () => {
            const cs = await open();
            expect(createSocketStub.callCount).to.equal(1);
            expect(createSocketStub.lastCall.args).to.eql(["wss://localhost/control/v1"]);
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
            await expect(WebSocketCommandStation.open("url=ws://127.0.0.1:0/")).to.be.rejectedWith(/(EADDRNOTAVAIL)|(ECONNREFUSED)/);
        })
    })

    describe("close", () => {
        it("should close underlying socket", async () => {
            const cs = await open();
            const promise = cs.close();
            expect(cs.state).to.equal(CommandStationState.SHUTTING_DOWN);
            webSocketMock.emit("close", 0, "closed");
            await promise;

            expect(cs.state).to.equal(CommandStationState.NOT_CONNECTED);
            expect(webSocketMock.close.callCount).to.equal(1);
            expect(webSocketMock.close.lastCall.args).to.eql([]);
        })

        it("should reject single outstanding request", async () => {
            const cs = await open();
            const promise = cs.readLocoCv(29);
            await nextTick();
            await close(cs);

            await expect(promise).to.be.eventually.rejectedWith("Connection closed");
        })

        it("should reject multiple outstanding request", async () => {
            const cs = await open();
            const promise1 = cs.readLocoCv(29);
            const promise2 = cs.readLocoCv(1);
            await nextTick();
            await close(cs);

            await expect(promise1).to.be.eventually.rejectedWith("Connection closed");
            await expect(promise2).to.be.eventually.rejectedWith("Connection closed");
        })

        it("should be safe to call overlapped", async () => {
            const cs = await open();
            const promise1 = cs.close();
            const promise2 = cs.close();
            webSocketMock.emit("close", 0, "closed");

            await promise1;
            await promise2;
        })

        it("should be safe to call if already closed", async () => {
            const cs = await open();
            await close(cs);
            await cs.close();
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
            const request = webSocketMock.sentData[0];
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

        it("raises exception if the connection is already closed", async () => {
            const cs = await open();
            await close(cs);

            await expect(cs.readLocoCv(29)).to.be.eventually.rejectedWith("Connection closed")
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

        it("raises exception if the connection is already closed", async () => {
            const cs = await open();
            await close(cs);

            await expect(cs.writeLocoCv(29, 38)).to.be.eventually.rejectedWith("Connection closed")
        })
    })

    describe("Overlapped requests", () => {
        it("should queue overlapped requests", async () => {
            const cs = await open();

            const request1 = cs.writeLocoCv(29, 6);
            await nextTick();
            const request2 = cs.writeLocoCv(29, 38);
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.BUSY);
            expect(webSocketMock.sentData).to.have.length(1);
            
            webSocketMock.postOk();
            await request1;

            expect(cs.state).to.equal(CommandStationState.BUSY);
            expect(webSocketMock.sentData).to.have.length(2);

            webSocketMock.postOk();
            await request2;
            expect(cs.state).to.equal(CommandStationState.IDLE);

            expect(webSocketMock.sentData[0].data).to.eql({
                cvs: [{
                    cv: 29,
                    value: 6
                }]
            });
            expect(webSocketMock.sentData[1].data).to.eql({
                cvs: [{
                    cv: 29,
                    value: 38
                }]
            });
        })
    })

    describe("Received message handling", () => {
        it("should ignore non-response messages", async () => {
            const cs = await open();

            webSocketMock.emit("message", JSON.stringify({
                type: messages.RequestType.LocoSpeed,
                tag: "foo",
                requestTime: "bar",
                data: "baz"
            } as messages.TransportMessage));
            await nextTick();
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("should ignore irrelevant messages", async () => {
            const cs = await open();

            webSocketMock.postResponse<string>("foo", "bar");
            await nextTick();
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it("should ignore malformed messages", async () => {
            const cs = await open();

            webSocketMock.emit("message", "dasgsdgs");
            await nextTick();
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
        })
    })

    describe("socket error handling", () => {
        it("should transition to error state on socket error", async () => {
            const eventListener = stub();
            const cs = await open();
            cs.on("state", eventListener);

            webSocketMock.emit("error", new Error("Socket Error"));

            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(eventListener.callCount).to.equal(1);
            expect(eventListener.lastCall.args).to.eql([
                CommandStationState.ERROR,
                CommandStationState.IDLE
            ]);
        })

        it("should transition to error state if the socket closes unexpectedly", async () => {
            const eventListener = stub();
            const cs = await open();
            cs.on("state", eventListener);

            webSocketMock.emit("close", -1, "closed");

            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(eventListener.callCount).to.equal(1);
            expect(eventListener.lastCall.args).to.eql([
                CommandStationState.ERROR,
                CommandStationState.IDLE
            ]);
        })

        it("should reject outstanding requests", async () => {
            const cs = await open();
            const promise1 = cs.writeLocoCv(1, 3);
            const promise2 = cs.writeLocoCv(29, 6);
            await nextTick();

            webSocketMock.emit("error", new Error("Socket Error"));

            await expect(promise1).to.be.eventually.rejectedWith("Socket Error");
            await expect(promise2).to.be.eventually.rejectedWith("Socket Error");
        })
    })

    describe("WebSocketCommandBatch", () => {
        describe("setLocomotiveSpeed", () => {
            it("should generate a valid request", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveSpeed(3, 64);

                const promise = batch.commit();
                await nextTick();

                expect(cs.state).to.equal(CommandStationState.BUSY);
                expect(webSocketMock.sentData).to.have.length(1);
                const request = webSocketMock.sentData[0];
                expect(request.type).to.equal(messages.RequestType.LocoSpeed);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 3,
                    speed: 64
                } as messages.LocoSpeedRequest);

                webSocketMock.postOk();
                await promise;
                expect(cs.state).to.equal(CommandStationState.IDLE);
            })

            it("should generate a valid batch", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveSpeed(12, 32, true);
                batch.setLocomotiveSpeed(9999, 127, false);

                const promise = batch.commit();
                await nextTick();

                expect(cs.state).to.equal(CommandStationState.BUSY);
                expect(webSocketMock.sentData).to.have.length(1);
                let request = webSocketMock.sentData[0];
                expect(request.type).to.equal(messages.RequestType.LocoSpeed);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 12,
                    speed: 32,
                    reverse: true
                } as messages.LocoSpeedRequest);

                webSocketMock.postOk();
                await nextTick();

                expect(webSocketMock.sentData).to.have.length(2);
                request = webSocketMock.sentData[1];
                expect(request.type).to.equal(messages.RequestType.LocoSpeed);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 9999,
                    speed: 127,
                    reverse: false
                } as messages.LocoSpeedRequest);

                webSocketMock.postOk();
                await promise;
                expect(cs.state).to.equal(CommandStationState.IDLE);
            })

            it("should raise excption if batch is committed", async () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());
                batch.setLocomotiveSpeed(3, 64);
                await batch.commit();

                expect(() => batch.setLocomotiveSpeed(1, 2)).to.throw("Command batch already committed");
            })

            it("should raise exception if loco id is invalid", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());

                expect(() => batch.setLocomotiveSpeed(0, 64)).to.throw("Address 0 outside of valid range");
                expect(() => batch.setLocomotiveSpeed(10000, 64)).to.throw("Address 10000 outside of valid range");
            })

            it("should raise exception if speed is invalid", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());

                expect(() => batch.setLocomotiveSpeed(3, -1)).to.throw("Speed -1 outside of valid range");
                expect(() => batch.setLocomotiveSpeed(3, 128)).to.throw("Speed 128 outside of valid range");
            })
        })

        describe("setLocomotiveFunction", () => {
            it("should generate a valid request", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveFunction(3, 1, FunctionAction.TRIGGER);

                const promise = batch.commit();
                await nextTick();

                expect(cs.state).to.equal(CommandStationState.BUSY);
                expect(webSocketMock.sentData).to.have.length(1);
                const request = webSocketMock.sentData[0];
                expect(request.type).to.equal(messages.RequestType.LocoFunction);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 3,
                    function: 1,
                    action: messages.FunctionAction.Trigger
                } as messages.LocoFunctionRequest);

                webSocketMock.postOk();
                await promise;
                expect(cs.state).to.equal(CommandStationState.IDLE);
            })

            it("should generate a valid batch", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveFunction(12, 12, FunctionAction.LATCH_ON);
                batch.setLocomotiveFunction(9999, 28, FunctionAction.LATCH_OFF);

                const promise = batch.commit();
                await nextTick();

                expect(cs.state).to.equal(CommandStationState.BUSY);
                expect(webSocketMock.sentData).to.have.length(1);
                let request = webSocketMock.sentData[0];
                expect(request.type).to.equal(messages.RequestType.LocoFunction);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 12,
                    function: 12,
                    action: messages.FunctionAction.LatchOn
                } as messages.LocoFunctionRequest);

                webSocketMock.postOk();
                await nextTick();

                expect(webSocketMock.sentData).to.have.length(2);
                request = webSocketMock.sentData[1];
                expect(request.type).to.equal(messages.RequestType.LocoFunction);
                expect(request.tag).to.be.a("string").and.not.empty;
                expect(request.requestTime).to.be.a("string").and.not.empty;
                expect(request.data).to.eql({
                    locoId: 9999,
                    function: 28,
                    action: messages.FunctionAction.LatchOff
                } as messages.LocoFunctionRequest);

                webSocketMock.postOk();
                await promise;
                expect(cs.state).to.equal(CommandStationState.IDLE);
            })

            it("should raise excption if batch is committed", async () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());
                batch.setLocomotiveFunction(3, 1, FunctionAction.TRIGGER);
                await batch.commit();

                expect(() => batch.setLocomotiveFunction(3, 1, FunctionAction.TRIGGER)).to.throw("Command batch already committed");
            })

            it("should raise exception if loco id is invalid", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());

                expect(() => batch.setLocomotiveFunction(0, 0, FunctionAction.LATCH_ON)).to.throw("Address 0 outside of valid range");
                expect(() => batch.setLocomotiveFunction(10000, 0, FunctionAction.LATCH_OFF)).to.throw("Address 10000 outside of valid range");
            })

            it("should raise exception if function is invalid", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());

                expect(() => batch.setLocomotiveFunction(3, -1, FunctionAction.TRIGGER)).to.throw("Function -1 outside of valid range");
                expect(() => batch.setLocomotiveFunction(3, 29, FunctionAction.TRIGGER)).to.throw("Function 29 outside of valid range");
            })

            it("should raise exception if action is invalid", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());

                expect(() => batch.setLocomotiveFunction(3, 0, -1)).to.throw("Invalid action -1");
                expect(() => batch.setLocomotiveFunction(3, 0, 4)).to.throw("Invalid action 4");
            })
        })

        describe("writeRaw", () => {
            it("should raise an exception", () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());
                expect(() => batch.writeRaw([0, 0, 0, 0])).to.throw("Raw writes are not unsupported");
            })
        })

        describe("commit", () => {
            it("should raise an exception if batch is already committed", async () => {
                const batch = new WebSocketCommandBatch(() => Promise.resolve());
                await batch.commit();
                await expect(batch.commit()).to.be.eventually.rejectedWith("Command batch already committed");
            })

            it("should raise an exception if there is a socket error while committing a batch", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_ON);
                batch.setLocomotiveSpeed(3, 32);
                const promise = batch.commit();
                await nextTick();

                webSocketMock.emit("error", new Error("Socket Error"));

                await expect(promise).to.be.eventually.rejectedWith("Socket Error");
            })

            it("should raise an exception if the connection is closed while committing a batch", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_ON);
                batch.setLocomotiveSpeed(3, 32);
                const promise = batch.commit();
                await nextTick();
                await close(cs);

                await expect(promise).to.be.eventually.rejectedWith("Connection closed");
            })

            it("raises exception if the connection is already closed", async () => {
                const cs = await open();
                const batch = await cs.beginCommandBatch();
                batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_ON);
                batch.setLocomotiveSpeed(3, 32);
                await close(cs);
    
                await expect(batch.commit()).to.be.eventually.rejectedWith("Connection closed")
            })
        });
    })
})