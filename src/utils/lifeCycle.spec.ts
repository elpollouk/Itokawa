import { expect } from "chai";
import "mocha";
import { SinonStub, stub, restore } from "sinon";
import { LifeCycle } from "./lifeCycle";

describe("LifeCycle", () => {
    let onshutdownbegin: SinonStub;
    let onrestartbegin: SinonStub;
    let onshutdown: SinonStub;
    let onrestart: SinonStub;
    let cleanup: SinonStub;
    let processExitStub: SinonStub;

    beforeEach(() => {
        onshutdownbegin = stub().resolves();
        onrestartbegin = stub().resolves();
        onshutdown = stub().resolves();
        onrestart = stub().resolves();
        cleanup = stub().resolves();
        processExitStub = stub(process,"exit");
    })

    afterEach(() => {
        restore();
    })

    function createLifeCycle() {
        const lifeCycle = new LifeCycle(cleanup);
        lifeCycle.onshutdownbegin = onshutdownbegin;
        lifeCycle.onrestartbegin = onrestartbegin;
        lifeCycle.onshutdown = onshutdown;
        lifeCycle.onrestart = onrestart;
        return lifeCycle;
    }

    describe("shutdown", () => {
        it("should call shutdown events in the correct order", async () => {
            const lifeCycle = createLifeCycle();
            await lifeCycle.shutdown();

            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(1);
            expect(onrestartbegin.callCount).to.eql(0);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should be safe to call if no event handlers are registered", async () => {
            const lifeCycle = new LifeCycle(cleanup);
            await lifeCycle.shutdown();

            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should be safe to call if no cleanup handler is registered", async () => {
            const lifeCycle = new LifeCycle();
            lifeCycle.onshutdownbegin = onshutdownbegin;
            lifeCycle.onshutdown = onshutdown;
            await lifeCycle.shutdown();

            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should not issue shutdown request if onshutdownbegin fails", async () => {
            onshutdownbegin.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await expect(lifeCycle.shutdown()).to.be.rejectedWith("Test Error");

            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(0);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(0);
            expect(processExitStub.callCount).to.eql(0);
        })

        it("should not issue shutdown request if cleanup fails", async () => {
            cleanup.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await expect(lifeCycle.shutdown()).to.be.rejectedWith("Test Error");

            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(0);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(0);
        })

        it("should still exit the process if onshut fails", async () => {
            onshutdown.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await lifeCycle.shutdown();

            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })
    })

    describe("restart", () => {
        it("should call restart events in the correct order", async () => {
            const lifeCycle = createLifeCycle();
            await lifeCycle.restart();

            expect(onshutdownbegin.callCount).to.eql(0);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(1);
            expect(onrestart.callCount).to.eql(1);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should be safe to call if no event handlers are registered", async () => {
            const lifeCycle = new LifeCycle(cleanup);
            await lifeCycle.restart();

            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should be safe to call if no cleanup handler is registered", async () => {
            const lifeCycle = new LifeCycle()
            lifeCycle.onrestartbegin = onrestartbegin;
            lifeCycle.onrestart = onrestart;
            await lifeCycle.restart();

            expect(onrestartbegin.callCount).to.eql(1);
            expect(onrestart.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })

        it("should not issue restart request if onshutdownbegin fails", async () => {
            onrestartbegin.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await expect(lifeCycle.restart()).to.be.rejectedWith("Test Error");

            expect(onshutdownbegin.callCount).to.eql(0);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(1);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(0);
            expect(processExitStub.callCount).to.eql(0);
        })

        it("should not issue restart request if cleanup fails", async () => {
            cleanup.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await expect(lifeCycle.restart()).to.be.rejectedWith("Test Error");

            expect(onshutdownbegin.callCount).to.eql(0);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(1);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(0);
        })

        it("should still exit the process if onshut fails", async () => {
            onrestart.rejects(new Error("Test Error"));

            const lifeCycle = createLifeCycle();
            await lifeCycle.restart();

            expect(processExitStub.callCount).to.eql(1);
            expect(processExitStub.lastCall.args).to.eql([0]);
        })
    })

    describe("beginSensitiveOperation", () => {
        it("should not be possible to shutdown or restart while a sensitive operation is in progress", async () => {
            const lifeCycle = createLifeCycle();
            const endOperation = lifeCycle.beginSensitiveOperation();

            expect(endOperation).to.be.instanceOf(Function);
            await expect(lifeCycle.shutdown()).to.be.eventually.rejectedWith("Life cycle change unavailable at this time");
            await expect(lifeCycle.restart()).to.be.eventually.rejectedWith("Life cycle change unavailable at this time");
            expect(onshutdownbegin.callCount).to.eql(0);
            expect(onshutdown.callCount).to.eql(0);
            expect(onrestartbegin.callCount).to.eql(0);
            expect(onrestart.callCount).to.eql(0);
            expect(cleanup.callCount).to.eql(0);
            expect(processExitStub.callCount).to.eql(0);
        })

        it("should not be possible to shutdown after a sensitive operation completes", async () => {
            const lifeCycle = createLifeCycle();
            const endOperation = lifeCycle.beginSensitiveOperation();
            endOperation();

            await lifeCycle.shutdown();
            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(1);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
        })

        it("should not be possible to restart after a sensitive operation completes", async () => {
            const lifeCycle = createLifeCycle();
            const endOperation = lifeCycle.beginSensitiveOperation();
            endOperation();

            await lifeCycle.restart();
            expect(onrestartbegin.callCount).to.eql(1);
            expect(onrestart.callCount).to.eql(1);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
        })

        it("should multiple sensitive operations should be tracked", async () => {
            const lifeCycle = createLifeCycle();
            const endOperation1 = lifeCycle.beginSensitiveOperation();
            const endOperation2 = lifeCycle.beginSensitiveOperation();

            endOperation1();
            await expect(lifeCycle.shutdown()).to.be.eventually.rejectedWith("Life cycle change unavailable at this time");

            endOperation2();
            await lifeCycle.shutdown();
            expect(onshutdownbegin.callCount).to.eql(1);
            expect(onshutdown.callCount).to.eql(1);
            expect(cleanup.callCount).to.eql(1);
            expect(processExitStub.callCount).to.eql(1);
        })

        it("should be possible to being a sensitive operation after a life cycle change fails", async () => {
            onrestartbegin.rejects(new Error("Foo"));
            const lifeCycle = createLifeCycle();

            await expect(lifeCycle.restart()).to.be.eventually.rejectedWith("Foo");

            const endOperation = lifeCycle.beginSensitiveOperation();
            expect(endOperation).to.be.instanceOf(Function);
        })

        it("should not be possible to end a sensitive operation twice", () => {
            const lifeCycle = createLifeCycle();
            const endOperation = lifeCycle.beginSensitiveOperation();
            endOperation();
            
            expect(() => endOperation()).to.throw("Operation has already signaled completion");
        })

        it("should not be possible to being a sensitive operation if a lifecycle change is in progress", () => {
            onshutdownbegin.returns(new Promise(() => {}));
            const lifeCycle = createLifeCycle();

            lifeCycle.shutdown();

            expect(() => lifeCycle.beginSensitiveOperation()).to.throw("Life cycle change in progress");
        })
    })
})
