import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import { application } from "../application";

import * as updateApplication from "./updateApplication";
import { response } from "express";

describe("updateApplication", () => {
    let spawnAsyncStub: SinonStub;
    let setTimeoutStub: SinonStub;
    let applicationRestartStub: SinonStub;
    let sender: SinonStub;
    let spawnExitCode = 0;

    beforeEach(() => {
        spawnAsyncStub = stub(updateApplication, "_spawnAsync").callsFake(() => Promise.resolve(spawnExitCode));
        setTimeoutStub = stub(updateApplication, "_setTimeout");
        applicationRestartStub = stub(application, "restart").returns(Promise.resolve());
        sender = stub().callsFake(() => Promise.resolve());
    })

    afterEach(async () => {
        // Flush out any hanging restarts
        if (setTimeoutStub.callCount != 0) {
            await setTimeoutStub.lastCall.args[0]();
        }
        spawnAsyncStub.restore();
        setTimeoutStub.restore();
        applicationRestartStub.restore();
    })

    it("should schedule a restart if update is successful", async () => {
        await updateApplication.updateApplication(sender);
        expect(spawnAsyncStub.callCount).to.equal(1);
        expect(spawnAsyncStub.lastCall.args[0]).to.equal("npm run prod-update");
        expect(setTimeoutStub.callCount).to.equal(1);
        expect(setTimeoutStub.lastCall.args[1]).to.equal(3000);
        expect(sender.lastCall.args[0].lastMessage).to.be.true;

        await setTimeoutStub.lastCall.args[0]();
        expect(applicationRestartStub.callCount).to.equal(1);
    })

    it("should be possible to run another update after the first finishes", async () => {
        await updateApplication.updateApplication(sender);
        await setTimeoutStub.lastCall.args[0]();
        await updateApplication.updateApplication(sender);
        expect(spawnAsyncStub.callCount).to.equal(2);
    })

    it("should catch restart errors", async () => {
        applicationRestartStub.returns(Promise.reject(new Error("Test error")));
        await updateApplication.updateApplication(sender);
        await setTimeoutStub.lastCall.args[0]();
    })

    it("should reject a second attempt to update if an update is strill in progress", async () => {
        await updateApplication.updateApplication(sender);
        expect(updateApplication.updateApplication(sender)).to.be.eventually.rejectedWith("An update is already in progress");
    })

    it("should report a failed update attempt", async () => {
        spawnExitCode = 1;
        expect(updateApplication.updateApplication(sender)).to.be.eventually.rejectedWith("Update failed, process exited with code 1");
    })

    it("should send stdout", async () => {
        let resolve: (exitCode: number)=>void;
        const spawnPromise = new Promise<number>((_resolve) => { resolve = _resolve; });
        spawnAsyncStub.returns(spawnPromise);

        const updatePromise = updateApplication.updateApplication(sender);
        spawnAsyncStub.lastCall.args[1]("stdout data");

        // Finish up the 
        resolve(0);
        await updatePromise;

        expect(sender.callCount).to.equal(2);
        expect(sender.getCall(0).args).to.eql([{
            lastMessage: false,
            data: "stdout data"
        }]);
    })

    it("should send stderr", async () => {
        let resolve: (exitCode: number)=>void;
        const spawnPromise = new Promise<number>((_resolve) => { resolve = _resolve; });
        spawnAsyncStub.returns(spawnPromise);

        const updatePromise = updateApplication.updateApplication(sender);
        spawnAsyncStub.lastCall.args[2]("stderr data");

        resolve(0);
        await updatePromise;

        expect(sender.callCount).to.equal(2);
        expect(sender.getCall(0).args).to.eql([{
            lastMessage: false,
            error: "stderr data"
        }]);
    })
})