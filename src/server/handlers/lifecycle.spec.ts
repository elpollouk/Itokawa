import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub, SinonSpy, restore } from "sinon";
import { registerHandlers } from "./lifecycle";
import { RequestType, LifeCycleRequest, LifeCycleAction } from "../../common/messages";
import * as handlers from "./handlers";
import { application } from "../../application";
import * as applicationUpdate from "../updateApplication";
let packageVersion = require("../../../package.json").version;

function createHandlerMap(): handlers.HandlerMap {
    return new Map<RequestType, (msg: any, send: handlers.Sender)=>Promise<void>>();
}

describe("Life Cycle Handler", () => {

    let sendStub: SinonSpy<any[], Promise<boolean>>;

    beforeEach(() => {
        sendStub = stub().returns(Promise.resolve(true));
    })

    describe("registerHandlers", () => {
        it("should register handlers for the correct message types", () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            expect(handlers.size).to.be.equal(1);
            expect(handlers.has(RequestType.LifeCycle)).to.be.true;
        })

        it("should reject invalid acations", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LifeCycle)({
                action: -1
            } as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Unrecognised life cycle action: -1");
        })
    })

    describe("Shutdown Request", () => {
        let shutdownStub: SinonStub;

        beforeEach(() => {
            shutdownStub = stub(application.lifeCycle, "shutdown").returns(Promise.resolve());
        })

        afterEach(() => {
            restore();
        })

        it("should request an application shutdown", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                action: LifeCycleAction.shutdown
            } as LifeCycleRequest, sendStub);

            expect(shutdownStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })
    })

    describe("Restart Request", () => {
        let restartStub: SinonStub;

        beforeEach(() => {
            restartStub = stub(application.lifeCycle, "restart").returns(Promise.resolve());
        })

        afterEach(() => {
            restore();
        })

        it("should request a restart", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                action: LifeCycleAction.restart
            } as LifeCycleRequest, sendStub);

            expect(restartStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })
    })

    describe("Update Request", () => {
        let updateApplicationStub: SinonStub;

        beforeEach(() => {
            updateApplicationStub = stub(applicationUpdate, "updateApplication")
                                    .callsFake((send: handlers.Sender) => {
                                        send({
                                            lastMessage: false,
                                            data: "Foo"
                                        });
                                        return Promise.resolve();
                                    });
        })

        afterEach(() => {
            restore();
        })

        it("should request an update", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                action: LifeCycleAction.update
            } as LifeCycleRequest, sendStub);

            expect(updateApplicationStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: false,
                data: "Foo"
            }]);
        })
    })

    describe("Update OS Request", () => {
        let updateOSStub: SinonStub;

        beforeEach(() => {
            updateOSStub = stub(applicationUpdate, "updateOS")
                                    .callsFake((send: handlers.Sender) => {
                                        send({
                                            lastMessage: false,
                                            data: "Bar"
                                        });
                                        return Promise.resolve();
                                    });
        })

        afterEach(() => {
            restore();
        })

        it("should request an update", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                action: LifeCycleAction.updateOS
            } as LifeCycleRequest, sendStub);

            expect(updateOSStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: false,
                data: "Bar"
            }]);
        })
    })

    describe("Ping Request", () => {
        let commandStationStub: SinonStub;
        let gitRevStub: SinonStub;
        let publicUrlStub: SinonStub;

        beforeEach(() => {
            commandStationStub = stub(application, "commandStation").value(null);
            gitRevStub = stub(application, "gitrev").value("gitrev");
            publicUrlStub = stub(application, "publicUrl").value("public_url");
        })

        afterEach(() => {
            restore();
        })

        it("should return a ping response for a null command station", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.ping
            } as LifeCycleRequest, sendStub);

            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                packageVersion: packageVersion,
                commandStation: "",
                commandStationState: -1,
                gitrev: "gitrev",
                publicUrl: "public_url",
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should return a ping response for a connected command station", async () => {
            commandStationStub.value({
                deviceId: "TestCommandStation",
                version: "1.2.3",
                state: 2
            });
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.ping
            } as LifeCycleRequest, sendStub);

            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                packageVersion: packageVersion,
                commandStation: "TestCommandStation 1.2.3",
                commandStationState: 2,
                gitrev: "gitrev",
                publicUrl: "public_url",
                data: "OK",
                lastMessage: true
            }]);
        })
    })
})