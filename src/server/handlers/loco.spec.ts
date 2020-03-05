import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import {createStubCommandStation } from "../../utils/testUtils";
import { RequestType, LocoSpeedRequest } from "../../common/messages";
import * as handlers from "./handlers";
import { application } from "../../application";
import { registerHandlers, resetSeenLocos } from "./loco";

function createHandlerMap(): handlers.HandlerMap {
    return new Map<RequestType, (msg: any, send: handlers.Sender)=>Promise<void>>();
}

function getHandler(type: RequestType): (msg: any, send: handlers.Sender)=>Promise<void> {
    const handlers = createHandlerMap();
    registerHandlers(handlers);
    return handlers.get(type);
}

async function setLocoSpeed(locoId: number, speed: number, reverse?: boolean) {
    await getHandler(RequestType.LocoSpeed)({
        locoId: locoId,
        speed: speed,
        reverse: reverse
    }, stub());
}

describe("Loco Handler", () => {
    let applicationCommandStationStub: SinonStub;
    let commandStationStub: any;
    let clientBroadcastStub: SinonStub;
    let senderStub: SinonStub;

    beforeEach(() => {
        commandStationStub = createStubCommandStation();
        applicationCommandStationStub = stub(application, "commandStation").value(commandStationStub);
        clientBroadcastStub = stub(handlers, "clientBroadcast").returns(Promise.resolve());
        senderStub = stub().returns(Promise.resolve);

        resetSeenLocos();
    })

    afterEach(() => {
        applicationCommandStationStub.restore();
        clientBroadcastStub.restore();
    })

    function resetCommandStation() {
        applicationCommandStationStub.restore();
        commandStationStub = createStubCommandStation();
        applicationCommandStationStub = stub(application, "commandStation").value(commandStationStub);
    }

    describe("registerHandlers", () => {
        it("should register all the required handlers", () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            expect(handlers.has(RequestType.LocoSpeed)).to.be.true;
            expect(handlers.has(RequestType.LocoSpeedRefresh)).to.be.true;
            expect(handlers.has(RequestType.EmergencyStop)).to.be.true;
        })
    })

    describe("onLocoSpeedRequest", () => {
        it("should respond correctly to a valid speed request", async () => {
            const handler = getHandler(RequestType.LocoSpeed);
            await handler({
                locoId: 3,
                speed: 127,
                reverse: true
            }, senderStub);

            expect(senderStub.callCount).to.equal(1);
            expect(senderStub.lastCall.args).eql([{
                lastMessage: true,
                data: "OK"
            }]);

            // Verify the speed change was sent to all clients
            expect(clientBroadcastStub.callCount).to.equal(1);
            expect(clientBroadcastStub.lastCall.args).to.eql([
                RequestType.LocoSpeed,
                {
                    locoId: 3,
                    speed: 127,
                    reverse: true
                }
            ]);

            // Verify the command was sent to the command station
            expect(commandStationStub.beginCommandBatch.callCount).to.equal(1);
            const commandBatch = commandStationStub.lastCommandBatch;
            expect(commandBatch.setLocomotiveSpeed.callCount).to.equal(1);
            expect(commandBatch.setLocomotiveSpeed.lastCall.args).to.eql([
                3,
                127,
                true
            ]);
            expect(commandBatch.commit.callCount).to.equal(1);
        })

        it("should reject the request if no command station is connected", async () => {
            application.commandStation = null;
            const handler = getHandler(RequestType.LocoSpeed);
            await expect(handler({
                locoId: 3,
                speed: 127,
                reverse: true
            }, senderStub)).to.be.eventually.rejectedWith("No command station connected");
        })
    })

    describe("onEmergencyStop", () => {
        it("should stop all seen locomotives", async () => {
            await setLocoSpeed(4, 100);
            await setLocoSpeed(6, 60, true);
            resetCommandStation();
            clientBroadcastStub.resetHistory();

            const handler = getHandler(RequestType.EmergencyStop);
            await handler({}, senderStub);

            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);

            // Verify stop commands were sent to the command station
            expect(commandStationStub.beginCommandBatch.callCount).to.equal(1);
            const commandBatch = commandStationStub.lastCommandBatch;
            expect(commandBatch.setLocomotiveSpeed.callCount).to.equal(2);
            expect(commandBatch.setLocomotiveSpeed.getCall(0).args).to.eql([
                4,
                0
            ]);
            expect(commandBatch.setLocomotiveSpeed.getCall(1).args).to.eql([
                6,
                0
            ]);
            expect(commandBatch.commit.callCount).to.equal(1);

            // Verify clients are notified of speed change
            expect(clientBroadcastStub.callCount).to.equal(2);
            expect(clientBroadcastStub.getCall(0).args).to.eql([
                RequestType.LocoSpeed,
                {
                    locoId: 4,
                    speed: 0,
                    reverse: false
                }
            ]);
            expect(clientBroadcastStub.getCall(1).args).to.eql([
                RequestType.LocoSpeed,
                {
                    locoId: 6,
                    speed: 0,
                    reverse: false
                }
            ]);
        })

        it("should only generate a single stop request even if multiple speed requests are made", async () => {
            await setLocoSpeed(5, 100);
            await setLocoSpeed(5, 60, true);
            resetCommandStation();
            clientBroadcastStub.resetHistory();

            const handler = getHandler(RequestType.EmergencyStop);
            await handler({}, senderStub);

            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);

            // Verify stop commands were sent to the command station
            expect(commandStationStub.beginCommandBatch.callCount).to.equal(1);
            const commandBatch = commandStationStub.lastCommandBatch;
            expect(commandBatch.setLocomotiveSpeed.callCount).to.equal(1);
            expect(commandBatch.setLocomotiveSpeed.getCall(0).args).to.eql([
                5,
                0
            ]);
            expect(commandBatch.commit.callCount).to.equal(1);

            // Verify clients are notified of speed change
            expect(clientBroadcastStub.callCount).to.equal(1);
            expect(clientBroadcastStub.getCall(0).args).to.eql([
                RequestType.LocoSpeed,
                {
                    locoId: 5,
                    speed: 0,
                    reverse: false
                }
            ]);
        })

        it("should be safe to call even if there have been no loco speed requests", async () => {
            const handler = getHandler(RequestType.EmergencyStop);
            await handler({}, senderStub);

            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);

            // Verify stop commands were sent to the command station
            expect(commandStationStub.beginCommandBatch.callCount).to.equal(0);

            // Verify clients are notified of speed change
            expect(clientBroadcastStub.callCount).to.equal(0);
        })

        it("should reject the request if no command station is connected", async () => {
            application.commandStation = null;
            const handler = getHandler(RequestType.EmergencyStop);
            await expect(handler({
                locoId: 3,
                speed: 127,
                reverse: true
            }, senderStub)).to.be.eventually.rejectedWith("No command station connected");
        })
    })

    describe("onLocoSpeedRefresh", () => {
        it("should report all seen locomotives", async () => {
            await setLocoSpeed(7, 50, true);
            await setLocoSpeed(8, 55);
            resetCommandStation();
            clientBroadcastStub.resetHistory();

            const handler = getHandler(RequestType.LocoSpeedRefresh);
            await handler({}, senderStub);

            // Verify no commands were sent to the command station
            expect(commandStationStub.beginCommandBatch.callCount).to.equal(0);

            // Verify client is notified of current speed
            expect(senderStub.callCount).to.equal(3);
            expect(senderStub.getCall(0).args).to.eql([
                {
                    lastMessage: false,
                    data: {
                        locoId: 7,
                        speed: 50,
                        reverse: true
                    }
                }
            ]);
            expect(senderStub.getCall(1).args).to.eql([
                {
                    lastMessage: false,
                    data: {
                        locoId: 8,
                        speed: 55,
                        reverse: false
                    }
                }
            ]);
            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })

        it("should only report the most recently seen speed", async () => {
            await setLocoSpeed(5, 100);
            await setLocoSpeed(5, 60, true);
            resetCommandStation();
            clientBroadcastStub.resetHistory();

            const handler = getHandler(RequestType.LocoSpeedRefresh);
            await handler({}, senderStub);

            expect(senderStub.callCount).to.equal(2);
            expect(senderStub.getCall(0).args).to.eql([
                {
                    lastMessage: false,
                    data: {
                        locoId: 5,
                        speed: 60,
                        reverse: true
                    }
                }
            ]);
            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })

        it("should be safe to call even if there have been no loco speed requests", async () => {
            const handler = getHandler(RequestType.LocoSpeedRefresh);
            await handler({}, senderStub);

            expect(senderStub.callCount).to.equal(1);
            expect(senderStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })

        it("should reject the request if no command station is connected", async () => {
            application.commandStation = null;
            const handler = getHandler(RequestType.LocoSpeedRefresh);
            await expect(handler({
                locoId: 3,
                speed: 127,
                reverse: true
            }, senderStub)).to.be.eventually.rejectedWith("No command station connected");
        })
    })
})