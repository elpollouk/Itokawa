import { expect } from "chai";
import "mocha";
import { nextTick } from "../utils/promiseUtils";
import { stub } from "sinon";
import { TaskProgress, TaskBase, TaskManager } from "./taskmanager";

class TestTask extends TaskBase {
    cancelCount = 0;

    constructor(id: number, readonly params?: any) {
        super(id, "Test Task");
    }

    protected _onCancel() {
        this.cancelCount += 1;
        this._onProgress({
            id: this.id,
            finished: true,
            error: "Cancelled"
        });
    }

    onProgress(progress: TaskProgress) {
        this._onProgress(progress);
    }

    fail(message: string) {
        this._fail(message);
    }
}

describe("Task Manager", () => {
    describe("TaskBase", () => {
        describe("construct", () => {
            it("should populate the required fields", () => {
                const task = new TestTask(123, "Foo");
                expect(task.id).to.equal(123);
                expect(task.name).to.equal("Test Task");
                expect(task.params).to.equal("Foo");
            })
        })

        describe("subscribe", () => {
            it("should be safe not to subsribe", () => {
                const task = new TestTask(1);

                const progress = {
                    id: 1,
                    finished: false,
                    out: "Test"
                }
                task.onProgress(progress);
            })


            it("should support multiple listeners", () => {
                const listener1 = stub();
                const listener2 = stub();
                const task = new TestTask(1);

                const progress = {
                    id: 1,
                    finished: false,
                    out: "Test"
                }
                expect(task.subscribe(listener1)).to.exist;
                expect(task.subscribe(listener2)).to.exist;
                task.onProgress(progress);

                expect(listener1.callCount).to.equal(1);
                expect(listener2.callCount).to.equal(1);
                expect(listener1.lastCall.args).to.eql([progress]);
                expect(listener2.lastCall.args).to.eql([progress]);
            })

            it("should raise finished result if subscribing to a finished task", async () => {
                const listener = stub();
                const task = new TestTask(1);
                const progress = {
                    id: 1,
                    finished: true,
                    out: "Test"
                }

                task.onProgress(progress);
                task.subscribe(listener);
                await nextTick();

                expect(listener.callCount).to.equal(1);
                expect(listener.lastCall.args).to.eql([progress]);
            })

            it("should raise error result if subscribing to a failed task", async () => {
                const listener = stub();
                const task = new TestTask(1);
                const progress = {
                    id: 1,
                    finished: true,
                    error: "Failed"
                }

                task.onProgress(progress);
                task.subscribe(listener);
                await nextTick();

                expect(listener.callCount).to.equal(1);
                expect(listener.lastCall.args).to.eql([progress]);
            })
        })

        describe("unsubscribe", () => {
            it("should correctly unsubscribe any subscribed listeners", () => {
                const listener1 = stub();
                const listener2 = stub();
                const task = new TestTask(1);

                const progress = {
                    id: 1,
                    finished: false,
                    out: "Test"
                }
                const handle = task.subscribe(listener1);
                task.subscribe(listener2);
                task.unsubscribe(handle);
                task.onProgress(progress);

                expect(listener1.callCount).to.equal(0);
                expect(listener2.callCount).to.equal(1);
                expect(listener2.lastCall.args).to.eql([progress]);
            })

            it("should be safe to use unsubscribed handle", () => {
                const task = new TestTask(1);
                task.unsubscribe({});
            })
        })

        describe("wait", () => {
            it("should return a promise that only completes when task reports finished progress", async () => {
                const then = stub();
                const error = stub();
                const task = new TestTask(1);
                
                task.wait().then(then, error);
                expect(then.callCount).to.equal(0);
                expect(error.callCount).to.equal(0);

                task.onProgress({
                    id: 1,
                    finished: true
                });
                await nextTick();

                expect(then.callCount).to.equal(1);
                expect(error.callCount).to.equal(0);
            })

            it("should report already completed tasks", async () => {
                const then = stub();
                const error = stub();
                const task = new TestTask(1);
                task.onProgress({
                    id: 1,
                    finished: true
                });
                task.wait().then(then, error);
                await nextTick();

                expect(then.callCount).to.equal(1);
                expect(error.callCount).to.equal(0);
            })

            it("should reject returns promise if task reports finished with an error", async () => {
                const task = new TestTask(1);
                const promise = task.wait();

                task.onProgress({
                    id: 1,
                    finished: true,
                    error: "Test Error"
                });
                await nextTick();

                await expect(promise).to.be.eventually.rejectedWith("Test Error");
            })

            it("should handle multiple waiters in a successful state", async () => {
                const then = stub();
                const error = stub();
                const katch = stub();
                const finaly = stub();
                const task = new TestTask(1);
                task.wait().then(then, error);
                task.wait().catch(katch);
                task.wait().finally(finaly);

                task.onProgress({
                    id: 1,
                    finished: true,
                    out: "Test"
                });
                await nextTick();

                expect(then.callCount).to.equal(1);
                expect(error.callCount).to.equal(0);
                expect(katch.callCount).to.equal(0);
                expect(finaly.callCount).to.equal(1);
            })

            it("should handle multiple waiters in a failed state", async () => {
                const then = stub();
                const error = stub();
                const katch = stub();
                const finaly = stub();
                const task = new TestTask(1);
                task.wait().then(then, error);
                task.wait().catch(katch);
                task.wait().finally(finaly).catch(stub());

                task.onProgress({
                    id: 1,
                    finished: true,
                    error: "Test"
                });
                await nextTick();

                expect(then.callCount).to.equal(0);
                expect(error.callCount).to.equal(1);
                expect(katch.callCount).to.equal(1);
                expect(finaly.callCount).to.equal(1);
            })
        })

        describe("cancel", () => {
            it("should invoke the _onCancel handler", async () => {
                const task = new TestTask(1);
                await expect(task.cancel()).to.be.eventually.rejectedWith("Cancelled");
                expect(task.cancelCount).to.equal(1);
            })

            it("should be safe to cancel an already complete task", async () => {
                const then = stub();
                const error = stub();
                const task = new TestTask(1);
                task.onProgress({
                    id: 1,
                    finished: true
                });

                task.cancel().then(then, error);
                await nextTick();

                expect(then.callCount).to.equal(1);
                expect(error.callCount).to.equal(0);
                expect(task.cancelCount).to.equal(0);
            })

            it("should re-report the exception if cancelling an already cancelled task", async () => {
                const task = new TestTask(1);
                await expect(task.cancel()).to.be.eventually.rejectedWith("Cancelled");
                await expect(task.cancel()).to.be.eventually.rejectedWith("Cancelled");
                expect(task.cancelCount).to.equal(1);
            })
        })

        describe("_onProgress", () => {
            it("should be safe to report progress if there are no waiters", () => {
                const task = new TestTask(1);
                task.onProgress({
                    id: 1,
                    finished: false,
                    out: "Foo"
                });
            })

            it("should raise an error if the wrong task id is used", () => {
                const task = new TestTask(1);
                expect(() => task.onProgress({
                    id: 0,
                    finished: false
                })).to.throw("Invalid task id provided for progress");
            })

            it("should raise an error if the task has already reported as finished", () => {
                const task = new TestTask(1);
                task.onProgress({
                    id: 1,
                    finished: true
                });

                expect(() => task.onProgress({
                    id: 1,
                    finished: true
                })).to.throw("Task has already finished");
            })
        })

        describe("_fail", () => {
            it("should cause the task to report an error", async () => {
                const listener = stub();
                const task = new TestTask(1234);
                task.subscribe(listener);

                task.fail("Test Fail");
                await expect(task.wait()).to.be.eventually.rejectedWith("Test Fail");
                expect(listener.callCount).to.equal(1);
                expect(listener.lastCall.args).to.eql([{
                    id: 1234,
                    finished: true,
                    error: "Test Fail"
                }]);
            })

            it("should raise an error if the task has already finished", () => {
                const task = new TestTask(1);
                task.onProgress({
                    id: 1,
                    finished: true
                });

                expect(() => task.fail("Foo")).to.throw("Task has already finished");
            })
        })
    })

    describe("startTask", () => {

    })
})