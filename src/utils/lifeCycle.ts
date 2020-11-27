
import { Logger } from "./logger";
const log = new Logger("LifeCycle");

async function mask(promise: Promise<void>) {
    try {
        await promise;
    } catch (ex) {
        log.error(ex.stack ?? ex);
    };
}

export class LifeCycle {
    // Callbacks to check if it's valid to proceed with life cycle change
    onshutdownbegin: ()=>Promise<void> = () => Promise.resolve();
    onrestartbegin: ()=>Promise<void> = () => Promise.resolve();
    // Callbacks to perform the actual life cycle changes
    onshutdown: ()=>Promise<void> = () => Promise.resolve();
    onrestart: ()=>Promise<void> = () => Promise.resolve();

    // If the count is positive, a senstive operation is in progress. A sensitive operation is any
    // task that could result in a currupt installation if interrupted by a life cycle change (e.g.
    // updating the OS).
    // If it's negative, a life cycle change is in progress
    private _lifeCycleLockCount = 0;

    constructor(private readonly _cleanUp: () => Promise<void> = () => Promise.resolve()) {

    }

    private _ensureExclusiveLifeCycleLock() {
        if (this._lifeCycleLockCount !== 0) throw new Error("Life cycle change unavailable at this time");
        this._lifeCycleLockCount = -1;
    }

    private async _handleLifeCycleChange(check: () => Promise<void>, exec: () => Promise<void>) {
        // Although many sensitive operations can be in progress at the same time, life cycle changes must
        // be run in isolation to avoid data corruption
        this._ensureExclusiveLifeCycleLock();
        try {
            await check();
            await this._cleanUp();
            await mask(exec()); // If the life cycle change fails, we still want to exit as we've already cleaned up
            process.exit(0);
        }
        finally {
            this._lifeCycleLockCount = 0;
        }
    }

    beginSensitiveOperation() {
        // If a life cycle change is in progress, we want to reject any attempt to start a sensitive operation
        if (this._lifeCycleLockCount < 0) throw new Error("Life cycle change in progress");
        this._lifeCycleLockCount++;

        // We return a release function to ensure that it is only possible to decrement the lock once per operation
        let lifeCycle = this;
        return () => {
            if (!lifeCycle) throw new Error("Operation has already signaled completion");
            lifeCycle._lifeCycleLockCount--;
            lifeCycle = null;
        };
    }

    shutdown() {
        log.info("Shutdown requested...");
        return this._handleLifeCycleChange(this.onshutdownbegin, this.onshutdown);
    }

    restart() {
        log.info("Reboot requested...");
        return this._handleLifeCycleChange(this.onrestartbegin, this.onrestart);
    }
}
