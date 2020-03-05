import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import {createStubCommandStation } from "../../utils/testUtils";
import { RequestType, LocoSpeedRequest } from "../../common/messages";
import * as handlers from "./handlers";
import { application } from "../../application";
import { registerHandlers } from "./loco";

function createHandlerMap(): handlers.HandlerMap {
    return new Map<RequestType, (msg: any, send: handlers.Sender)=>Promise<void>>();
}

function getHandler(type: RequestType): (msg: any, send: handlers.Sender)=>Promise<void> {
    const handlers = createHandlerMap();
    registerHandlers(handlers);
    return handlers.get(type);
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
    })

    afterEach(() => {
        applicationCommandStationStub.restore();
        clientBroadcastStub.restore();
    })

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
            } as LocoSpeedRequest, senderStub);

            expect(senderStub.callCount).to.equal(1);
            expect(senderStub.lastCall.args).eql([{
                lastMessage: true,
                data: "OK"
            }]);

            expect(clientBroadcastStub.callCount).to.equal(1);
            expect(clientBroadcastStub.lastCall.args).to.eql([
                RequestType.LocoSpeed,
                {
                    locoId: 3,
                    speed: 127,
                    reverse: true
                }
            ])
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
})