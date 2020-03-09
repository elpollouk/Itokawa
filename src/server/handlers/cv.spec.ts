import { expect } from "chai";
import "mocha";
import { stub, SinonStub, SinonSpy } from "sinon";
import * as handlers from "./handlers"
import { RequestType, LocoCvReadRequest, LocoCvWriteRequest } from "../../common/messages";
import { application } from "../../application";
import { NullCommandStation } from "../../devices/commandStations/null";
import { registerHandlers } from "./cv";

function createHandlerMap(): handlers.HandlerMap {
    return new Map<RequestType, (msg: any, send: handlers.Sender)=>Promise<void>>();
}

describe("CV Handler", () => {

    let applicationCommandStationStub: SinonStub;
    let sendStub: SinonSpy<any[], Promise<boolean>>;

    beforeEach(() => {
        applicationCommandStationStub = stub(application, "commandStation").value(new NullCommandStation());
        sendStub = stub().returns(Promise.resolve(true));
    })

    afterEach(() => {
        applicationCommandStationStub.restore();
    })

    describe("registerHandlers", () => {
        it("should register handlers for the correct message types", () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            expect(handlers.size).to.be.equal(2);
            expect(handlers.has(RequestType.LocoCvRead)).to.be.true;
            expect(handlers.has(RequestType.LocoCvWrite)).to.be.true;
        })
    })

    describe("Loco CV Read Request", () => {
        it("should read list of CVs", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvRead)({
                cvs: [8, 7, 1]
            } as LocoCvReadRequest, sendStub);

            expect(sendStub.callCount).to.equal(4);
            expect(sendStub.getCall(0).args).to.eql([{
                data: 255,
                lastMessage: false
            }]);
            expect(sendStub.getCall(1).args).to.eql([{
                data: 100,
                lastMessage: false
            }]);
            expect(sendStub.getCall(2).args).to.eql([{
                data: 3,
                lastMessage: false
            }]);
            expect(sendStub.getCall(3).args).to.eql([{
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should handle up to three read errors", async () => {
            let errorCount = 3;
            stub(application.commandStation, "readLocoCv").callsFake((cv) => {
                if (errorCount !== 0) {
                    errorCount--;
                    return Promise.reject(new Error("Error reading CV"));
                }
                return Promise.resolve(6);
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvRead)({
                cvs: [29]
            } as LocoCvReadRequest, sendStub);

            expect(sendStub.callCount).to.equal(2);
            expect(sendStub.getCall(0).args).to.eql([{
                data: 6,
                lastMessage: false
            }]);
            expect(sendStub.getCall(1).args).to.eql([{
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should reject on fourth read error", async () => {
            let errorCount = 4;
            stub(application.commandStation, "readLocoCv").callsFake((cv) => {
                if (errorCount !== 0) {
                    errorCount--;
                    return Promise.reject(new Error("Error reading CV"));
                }
                return Promise.resolve(6);
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)({
                cvs: [29]
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("Error reading CV");
        })

        it("should reject empty CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)({
                cvs: []
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })

        it("should reject null CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)({
                cvs: null
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })
    })

    describe("Loco CV Write Request", () => {
        it("should write list of CVs", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvWrite)({
                cvs: [{
                    cv: 17,
                    value: 196
                }, {
                    cv: 18,
                    value: 210
                }, {
                    cv: 29,
                    value: 38
                }]
            } as LocoCvWriteRequest, sendStub);

            expect(sendStub.callCount).to.equal(4);
            expect(sendStub.getCall(0).args).to.eql([{
                data: 17,
                lastMessage: false
            }]);
            expect(sendStub.getCall(1).args).to.eql([{
                data: 18,
                lastMessage: false
            }]);
            expect(sendStub.getCall(2).args).to.eql([{
                data: 29,
                lastMessage: false
            }]);
            expect(sendStub.lastCall.args).to.eql([{
                data: "OK",
                lastMessage: true
            }]);

            expect(await application.commandStation.readLocoCv(29)).to.equal(38);
            expect(await application.commandStation.readLocoCv(17)).to.equal(196);
            expect(await application.commandStation.readLocoCv(18)).to.equal(210);
        })

        it("should handle up to three write errors", async () => {
            let errorCount = 3;
            stub(application.commandStation, "writeLocoCv").callsFake((cv, value) => {
                if (errorCount !== 0) {
                    errorCount--;
                    return Promise.reject(new Error("Error writing CV"));
                }
                return Promise.resolve();
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvWrite)({
                cvs: [{
                    cv: 29,
                    value: 6
                }]
            } as LocoCvWriteRequest, sendStub);

            expect(sendStub.callCount).to.equal(2);
            expect(sendStub.getCall(0).args).to.eql([{
                data: 29,
                lastMessage: false
            }]);
            expect(sendStub.lastCall.args).to.eql([{
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should reject on fourth write error", async () => {
            let errorCount = 4;
            stub(application.commandStation, "writeLocoCv").callsFake((cv, value) => {
                if (errorCount !== 0) {
                    errorCount--;
                    return Promise.reject(new Error("Error writing CV"));
                }
                return Promise.resolve();
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)({
                cvs: [{
                    cv: 29,
                    value: 6
                }]
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("Error writing CV");
        })

        it("should reject empty CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)({
                cvs: []
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })

        it("should reject null CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)({
                cvs: null
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })
    })
})
