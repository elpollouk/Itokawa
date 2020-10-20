import { expect } from "chai";
import "mocha";
import { SinonStub, stub, restore } from "sinon";
import { application } from "../../application";
import * as promiseUtils from "../../utils/promiseUtils";
import { nextTick }from "../../utils/promiseUtils";
import { createStubCommandStation } from "../../utils/testUtils";
import { RunInTask } from "./runin";

function startTask(locoId: number, speed: number, seconds: number) {
    return new RunInTask(0, {
        locoId: locoId,
        speed: speed,
        seconds: seconds
    });
}

describe("Run In Task", () => {
    let commandStation;
    let timeoutStub: SinonStub;

    beforeEach(() => {
        commandStation = createStubCommandStation();
        stub(application, "commandStation").value(commandStation);
        timeoutStub = stub(promiseUtils, "timeout").callsFake(async () => {
            // We need this function to yield its time slice, otherwise everything runs instantly
            await nextTick();
            return Promise.resolve();
        });
    })

    afterEach(() => {
        restore();
    })

    describe("factory", () => {
        it("should return task with the correct properties", async () => {
            const task = await RunInTask.factory(123, {
                locoId: 3,
                speed: 32,
                seconds: 2
            });

            expect(task.id).to.equal(123);
            expect(task.name).to.equal(RunInTask.TASK_NAME);
            expect(task.progress).to.eql({
                id: 123,
                finished: false,
                progress: 0,
                progressTarget: 2
            });

            await task.wait();
        })

        it("should reject invalid loco ids", async () => {
            await expect(RunInTask.factory(0, {
                locoId: -1,
                speed: 32,
                seconds: 2
            })).to.be.eventually.rejectedWith("Address -1 outside of valid range");
        })

        it("should reject invalid speeds", async () => {
            await expect(RunInTask.factory(0, {
                locoId: 1,
                speed: -1,
                seconds: 2
            })).to.be.eventually.rejectedWith("Speed -1 outside of valid range");
        })

        it("should reject invalid times", async () => {
            await expect(RunInTask.factory(0, {
                locoId: 1,
                speed: 64,
                seconds: 0
            })).to.be.eventually.rejectedWith("0 is in valid time value");
        })
    })
 
    describe("Task Execution", () => {
        it("should run for the specified time", async () => {
            const task = startTask(1, 64, 10);
            await task.wait();

            expect(timeoutStub.callCount).to.equal(10);
            for (let i = 0; i < timeoutStub.callCount; i++) {
                expect(timeoutStub.getCall(i).args).to.eql([1]);
            }
        })

        it("should fail task if there is a command station error", async () => {
            commandStation.lastCommandBatch.commit.rejects(new Error("Test Error"));
            const task = startTask(1, 64, 4);
            await expect(task.wait()).to.be.eventually.rejectedWith("Test Error");
        })

        it("should be possible to cancel the task", async () => {
            const task = startTask(1, 64, 1000);
            await nextTick();
            await nextTick();
            await task.cancel();

            expect(timeoutStub.callCount).to.be.lessThan(10);
        })
    })
})