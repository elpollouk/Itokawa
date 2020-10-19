import { expect } from "chai";
import "mocha";
import { stub, SinonStub, SinonSpy } from "sinon";
import { TaskProgress, TaskBase, TaskManager } from "./taskmanager";

class TestTask extends TaskBase {
    constructor(id: number, readonly params?: any) {
        super(id, "Test Task");
    }

    protected _onCancel() {
        this._onProgress({
            id: this.id,
            finished: true,
            error: "Cancelled"
        });
    }

    onProgress(progress: TaskProgress) {
        this._onProgress(progress);
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
    })

    describe("startTask", () => {

    })
})