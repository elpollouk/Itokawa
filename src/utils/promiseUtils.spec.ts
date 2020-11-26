import { expect } from "chai";
import "mocha";
import { mock, SinonStub, stub } from "sinon";
import { EventEmitter } from "events";
import { firedEvent, nextTick, OutArg, CancelFunc, timeout, SignalablePromise } from "./promiseUtils";

describe("Promise Utils", () => {
    describe("timeout", () => {
        it("should wait desired time, no cancel", async () => {
            let emitter = new EventEmitter();

            let cancel = new OutArg<CancelFunc>();
            await timeout(0.1, cancel);
        });

        it("should wait desired time, cancel available", async () => {
            let emitter = new EventEmitter();

            await timeout(0.1);
        });


        it("should be cancelable", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            let cancel = new OutArg<CancelFunc>();
            timeout(10, cancel).then(succeeded, rejected);

            cancel.value();
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(1);
            expect(rejected.getCall(0).args[0].message).to.equal("Cancelled");
        });
    });

    describe("firedEvent", () => {
        it("should wait until event is raised with no args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test").then(succeeded, rejected);
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(0);

            emitter.emit("test");
            await nextTick();
            expect(succeeded.callCount).to.equal(1);
            expect(rejected.callCount).to.equal(0);
        });

        it("should wait until event is raised with args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test", "A", 2).then(succeeded, rejected);

            emitter.emit("test", "A", 2);
            await nextTick();
            expect(succeeded.callCount).to.equal(1);
            expect(rejected.callCount).to.equal(0);
        });

        it("should wait until event is raised with partial args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test", "B").then(succeeded, rejected);

            emitter.emit("test", "B", 1);
            await nextTick();
            expect(succeeded.callCount).to.equal(1);
            expect(rejected.callCount).to.equal(0);
        });

        it("should not complete if different event fired", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test").then(succeeded, rejected);

            emitter.emit("foo");
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(0);
        });

        it("should not complete if some args are different", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test", "A", 3).then(succeeded, rejected);

            emitter.emit("test", "A", 2);
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(0);
        });

        it("should be safe if event fires again", async () => {
            let emitter = new EventEmitter();

            let promise = firedEvent(emitter, "test");

            emitter.emit("test");
            await promise;
            emitter.emit("test");
            await nextTick();
            await nextTick();
            await nextTick();
        });

        it("should not complete if different partial args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test", "A").then(succeeded, rejected);

            emitter.emit("test", "B", "A");
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(0);
        });

        it("should not complete if fewer args than expected", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            firedEvent(emitter, "test", "A").then(succeeded, rejected);

            emitter.emit("test");
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(0);
        });

        it("should be cancelable with no args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            let cancel = new OutArg<CancelFunc>();
            firedEvent(emitter, "test", cancel).then(succeeded, rejected);

            cancel.value();
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(1);
            expect(rejected.getCall(0).args[0].message).to.equal("Cancelled");
        });

        it("should be cancelable with args", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            let cancel = new OutArg<CancelFunc>();
            firedEvent(emitter, "test", cancel, "A").then(succeeded, rejected);

            cancel.value();
            await nextTick();
            expect(succeeded.callCount).to.equal(0);
            expect(rejected.callCount).to.equal(1);
            expect(rejected.getCall(0).args[0].message).to.equal("Cancelled");
        });

        it("should wait on event with args and out cancel function", async () => {
            let emitter = new EventEmitter();
            let succeeded = mock();
            let rejected = mock();

            let cancel = new OutArg<CancelFunc>();
            firedEvent(emitter, "test", cancel, "A").then(succeeded, rejected);

            emitter.emit("test", "A");
            await nextTick();
            expect(succeeded.callCount).to.equal(1);
            expect(rejected.callCount).to.equal(0);
        });
    });

    describe("SignalablePromise", () => {

        let resolvedCb: SinonStub;
        let rejectedCb: SinonStub;
        let catchCb: SinonStub;
        let finallyCb: SinonStub;

        function createPromise<T = void>() {
            resolvedCb = stub();
            rejectedCb = stub();
            catchCb = stub();
            finallyCb = stub();
            const promise = new SignalablePromise<T>();
            promise.then(resolvedCb, rejectedCb);
            promise.catch(catchCb);
            promise.finally(finallyCb);

            return promise;
        }

        describe("resolve", () => {
            it("should trigger then and finally callbacks for a void promise", async () => {
                const promise = createPromise();

                promise.resolve();
                await nextTick();

                expect(resolvedCb.callCount).to.eql(1);
                expect(rejectedCb.callCount).to.eql(0);
                expect(catchCb.callCount).to.eql(0);
                expect(finallyCb.callCount).to.eql(1);
                expect(finallyCb.lastCall.args).to.be.empty;
            })

            it("should trigger then and finally callbacks for a string promise", async () => {
                const promise = createPromise<string>();

                promise.resolve("Test");
                await nextTick();

                expect(resolvedCb.callCount).to.eql(1);
                expect(resolvedCb.lastCall.args).to.eql(["Test"]);
                expect(rejectedCb.callCount).to.eql(0);
                expect(catchCb.callCount).to.eql(0);
                expect(finallyCb.callCount).to.eql(1);
                expect(finallyCb.lastCall.args).to.be.empty;
            })

            it ("should return value to waiters", async () => {
                const promise = new SignalablePromise<number>();

                promise.resolve(123);

                expect(await promise).to.eql(123);
            })
        })

        describe("reject", () => {
            it("should trigger errors for waiters when rejected", async () => {
                const promise = new SignalablePromise();
                
                promise.reject(new Error("Test Error"));

                await expect(promise).to.be.eventually.rejectedWith("Test Error");
            })
        })
    })
});
