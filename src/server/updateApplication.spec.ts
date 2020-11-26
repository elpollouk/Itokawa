import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon";
import { application } from "../application";
import { ConfigNode } from "../utils/config";

import * as updater from "./updateApplication";

describe("Updater", () => {
    let spawnAsyncStub: SinonStub;
    let setTimeoutStub: SinonStub;
    let applicationRestartStub: SinonStub;
    let sender: SinonStub;
    let platformStub: SinonStub;
    let spawnExitCode = 0;

    beforeEach(() => {
        spawnExitCode = 0;
        spawnAsyncStub = stub(updater, "_spawnAsync").callsFake(() => Promise.resolve(spawnExitCode));
        setTimeoutStub = stub(updater, "_setTimeout");
        applicationRestartStub = stub(application, "restart").returns(Promise.resolve());
        sender = stub().callsFake(() => Promise.resolve());

        platformStub = stub(process, "platform").value("linux");
    })

    afterEach(async () => {
        // Flush out any hanging restarts
        if (setTimeoutStub.callCount != 0) {
            await setTimeoutStub.lastCall.args[0]();
        }
        restore();
    })

    describe("updateApplication", () => {
        it("should schedule a restart if update is successful", async () => {
            await updater.updateApplication(sender);
            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("npm run prod-update");
            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(3000);
            expect(sender.lastCall.args[0].lastMessage).to.be.true;

            await setTimeoutStub.lastCall.args[0]();
            expect(applicationRestartStub.callCount).to.equal(1);
        })

        it("should be possible to run another update after the first finishes", async () => {
            await updater.updateApplication(sender);
            await setTimeoutStub.lastCall.args[0]();
            await updater.updateApplication(sender);
            expect(spawnAsyncStub.callCount).to.equal(2);
        })

        it("should catch restart errors", async () => {
            applicationRestartStub.returns(Promise.reject(new Error("Test error")));
            await updater.updateApplication(sender);
            await setTimeoutStub.lastCall.args[0]();
        })

        it("should reject a second attempt to update if an update is strill in progress", async () => {
            await updater.updateApplication(sender);
            expect(updater.updateApplication(sender)).to.be.eventually.rejectedWith("An update is already in progress");
        })

        it("should report a failed update attempt", async () => {
            spawnExitCode = 1;
            expect(updater.updateApplication(sender)).to.be.eventually.rejectedWith("Update failed, process exited with code 1");
        })

        it("should send stdout", async () => {
            let resolve: (exitCode: number)=>void;
            const spawnPromise = new Promise<number>((_resolve) => { resolve = _resolve; });
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateApplication(sender);
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

            const updatePromise = updater.updateApplication(sender);
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

    describe("updateOS", () => {
        it("issue the correct command", async () => {
            await updater.updateOS(sender);
            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("sudo apt-get update && sudo apt-get -y dist-upgrade");
            expect(sender.lastCall.args[0].lastMessage).to.be.true;
        })

        it("should be possible to run another update after the first finishes", async () => {
            await updater.updateOS(sender);
            await updater.updateOS(sender);
            expect(spawnAsyncStub.callCount).to.equal(2);
        })

        it("should report a failed update attempt", async () => {
            spawnExitCode = 1;
            expect(updater.updateOS(sender)).to.be.eventually.rejectedWith("Update failed, process exited with code 1");
        })

        it("should send stdout", async () => {
            let resolve: (exitCode: number)=>void;
            const spawnPromise = new Promise<number>((_resolve) => { resolve = _resolve; });
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateOS(sender);
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

            const updatePromise = updater.updateOS(sender);
            spawnAsyncStub.lastCall.args[2]("stderr data");

            resolve(0);
            await updatePromise;

            expect(sender.callCount).to.equal(2);
            expect(sender.getCall(0).args).to.eql([{
                lastMessage: false,
                error: "stderr data"
            }]);
        })

        it("should not run under Windows if no command specified", async () => {
            platformStub.value("win32");
            await expect(updater.updateOS(sender)).to.be.eventually.rejectedWith("OS update not configured for win32");
        })

        it("should run on Windows if an explicit command is set", async () => {
            platformStub.value("win32");
            const config = new ConfigNode();
            config.set("server.commands.updateOS", "wup.ps1");
            stub(application, "config").value(config);

            await updater.updateOS(sender);

            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("wup.ps1");
        })
    })
})
