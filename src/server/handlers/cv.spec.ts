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

const MOCK_CONTEXT: handlers.ConnectionContext = {};

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

            await handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: [8, 7, 1]
            } as LocoCvReadRequest, sendStub);

            expect(sendStub.callCount).to.equal(4);
            expect(sendStub.getCall(0).args).to.eql([{
                data: {
                    cv: 8,
                    value: 255
                },
                lastMessage: false
            }]);
            expect(sendStub.getCall(1).args).to.eql([{
                data: {
                    cv: 7,
                    value: 100
                },
                lastMessage: false
            }]);
            expect(sendStub.getCall(2).args).to.eql([{
                data: {
                    cv: 1,
                    value: 3
                },
                lastMessage: false
            }]);
            expect(sendStub.getCall(3).args).to.eql([{
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should stop attempting to read CVs if the WebSocket disconnects", async () => {
            let sendLimit = 2;
            sendStub = stub().callsFake(() => {
                if (sendLimit-- <= 0) {
                    return Promise.resolve(false);
                }
                return Promise.resolve(true);
            })

            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: [8, 7, 29, 1, 17, 18]
            } as LocoCvReadRequest, sendStub);

            expect(sendStub.callCount).to.equal(3);
        })

        it("should handle up to three read errors", async () => {
            let errorCount = 3;
            stub(application.commandStation, "readLocoCv").callsFake((cv) => {
                if (errorCount-- !== 0) {
                    return Promise.reject(new Error("Error reading CV"));
                }
                return Promise.resolve(6);
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: [29]
            } as LocoCvReadRequest, sendStub);

            expect(sendStub.callCount).to.equal(2);
            expect(sendStub.getCall(0).args).to.eql([{
                data: {
                    cv: 29,
                    value: 6
                },
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
                if (errorCount-- !== 0) {
                    return Promise.reject(new Error("Error reading CV"));
                }
                return Promise.resolve(6);
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: [29]
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("Error reading CV");
        })

        it("should reject if any CVs are invalid", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: [1, 3, 256]
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("CV 256 outside of valid range");
        })

        it("should reject empty CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: []
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })

        it("should reject null CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvRead)(MOCK_CONTEXT, {
                cvs: null
            } as LocoCvReadRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })
    })

    describe("Loco CV Write Request", () => {
        it("should write list of CVs", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
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
                data: { cv: 17, value: 196 },
                lastMessage: false
            }]);
            expect(sendStub.getCall(1).args).to.eql([{
                data: { cv: 18, value: 210 },
                lastMessage: false
            }]);
            expect(sendStub.getCall(2).args).to.eql([{
                data: { cv: 29, value: 38 },
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

        it("should continue writing CVs if the WebSocket disconnects", async () => {
            let sendLimit = 2;
            sendStub = stub().callsFake(() => {
                if (sendLimit-- <= 0) {
                    return Promise.resolve(false);
                }
                return Promise.resolve(true);
            })

            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: [{
                    cv: 29,
                    value: 255
                }, {
                    cv: 1,
                    value: 254
                }, {
                    cv: 17,
                    value: 253
                }, {
                    cv: 18,
                    value: 252
                }]
            } as LocoCvWriteRequest, sendStub);

            expect(await application.commandStation.readLocoCv(29)).to.equal(255);
            expect(await application.commandStation.readLocoCv(1)).to.equal(254);
            expect(await application.commandStation.readLocoCv(17)).to.equal(253);
            expect(await application.commandStation.readLocoCv(18)).to.equal(252);
        })

        it("should handle up to three write errors", async () => {
            let errorCount = 3;
            stub(application.commandStation, "writeLocoCv").callsFake((cv, value) => {
                if (errorCount-- !== 0) {
                    return Promise.reject(new Error("Error writing CV"));
                }
                return Promise.resolve();
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: [{
                    cv: 29,
                    value: 6
                }]
            } as LocoCvWriteRequest, sendStub);

            expect(sendStub.callCount).to.equal(2);
            expect(sendStub.getCall(0).args).to.eql([{
                data: { cv: 29, value: 6 },
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
                if (errorCount-- !== 0) {
                    return Promise.reject(new Error("Error writing CV"));
                }
                return Promise.resolve();
            })
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: [{
                    cv: 29,
                    value: 6
                }]
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("Error writing CV");
        })

        it("should not write and reject if any CVs are invalid", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: [{
                    cv: 1,
                    value: 10,
                 }, {
                    cv: 256,
                    value: 10
                 }]
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("CV 256 outside of valid range");
            expect(await application.commandStation.readLocoCv(1)).to.equal(3);
        })

        it("should not write and reject if any values are invalid", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: [{
                    cv: 1,
                    value: 10,
                 }, {
                    cv: 29,
                    value: 256
                 }]
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("Byte(256) outside of valid range");
            expect(await application.commandStation.readLocoCv(1)).to.equal(3);
            expect(await application.commandStation.readLocoCv(29)).to.equal(6);
        })

        it("should reject empty CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: []
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })

        it("should reject null CV list", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LocoCvWrite)(MOCK_CONTEXT, {
                cvs: null
            } as LocoCvWriteRequest, sendStub)).to.be.eventually.rejectedWith("No CVs provided");
        })
    })
})
