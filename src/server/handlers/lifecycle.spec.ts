import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub, SinonSpy, restore } from "sinon";
import { createMockConnectionContext, removePermission } from "../../utils/testUtils";
import { registerHandlers } from "./lifecycle";
import { RequestType, LifeCycleRequest, LifeCycleAction } from "../../common/messages";
import * as handlers from "./handlers";
import { application } from "../../application";
import * as applicationUpdate from "../updater";
import { Permissions } from "../sessionmanager";
let packageVersion = require("../../../package.json").version;

function createHandlerMap(): handlers.HandlerMap {
    return new Map<RequestType, (msg: any, send: handlers.Sender)=>Promise<void>>();
}

describe("Life Cycle Handler", () => {

    let sendStub: SinonSpy<any[], Promise<boolean>>;
    let mockContext: handlers.ConnectionContext;

    beforeEach(() => {
        sendStub = stub().returns(Promise.resolve(true));
        mockContext = createMockConnectionContext();
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

            await expect(handlers.get(RequestType.LifeCycle)(mockContext, {
                action: -1
            } as unknown as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Unrecognised life cycle action: -1");
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

            await handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.shutdown
            } as LifeCycleRequest, sendStub);

            expect(shutdownStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })

        it("should reject if session doesn't have permission", async () => {
            removePermission(mockContext, Permissions.SERVER_CONTROL);
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.shutdown
            } as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Access Denied");
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

            await handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.restart
            } as LifeCycleRequest, sendStub);

            expect(restartStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: true,
                data: "OK"
            }]);
        })

        it("should reject if session doesn't have permission", async () => {
            removePermission(mockContext, Permissions.SERVER_CONTROL);
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.restart
            } as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Access Denied");
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

            await handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.update
            } as LifeCycleRequest, sendStub);

            expect(updateApplicationStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: false,
                data: "Foo"
            }]);
        })

        it("should reject if session doesn't have permission", async () => {
            removePermission(mockContext, Permissions.APP_UPDATE);
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.update
            } as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Access Denied");
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

            await handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.updateOS
            } as LifeCycleRequest, sendStub);

            expect(updateOSStub.callCount).to.equal(1);
            expect(sendStub.callCount).to.equal(1);
            expect(sendStub.lastCall.args).to.eql([{
                lastMessage: false,
                data: "Bar"
            }]);
        })

        it("should reject if session doesn't have permission", async () => {
            removePermission(mockContext, Permissions.SERVER_UPDATE);
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await expect(handlers.get(RequestType.LifeCycle)(mockContext, {
                action: LifeCycleAction.updateOS
            } as LifeCycleRequest, sendStub)).to.be.eventually.rejectedWith("Access Denied");
        })
    })

    describe("Ping Request", () => {
        let commandStationStub: SinonStub;

        beforeEach(() => {
            commandStationStub = stub(application, "commandStation").value(null);
            stub(application, "gitrev").value("gitrev");
            stub(application, "publicUrl").value("public_url");
        })

        afterEach(() => {
            restore();
        })

        it("should return a ping response for a null command station", async () => {
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)(mockContext, {
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
                isSignedIn: true,
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

            await handlers.get(RequestType.LifeCycle)(mockContext, {
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
                isSignedIn: true,
                data: "OK",
                lastMessage: true
            }]);
        })

        it("should return not signed in based on connection context", async () => {
            mockContext.isSignedIn = false;
            const handlers = createHandlerMap();
            registerHandlers(handlers);

            await handlers.get(RequestType.LifeCycle)(mockContext, {
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
                isSignedIn: false,
                data: "OK",
                lastMessage: true
            }]);
        })
    })
})