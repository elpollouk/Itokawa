
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

    private _exclusiveLock = false;
    private _sensitiveOperations = new Set<string>();

    constructor(private readonly _cleanUp: () => Promise<void> = () => Promise.resolve()) {

    }

    private _ensureExclusiveLifeCycleLock() {
        if (this._exclusiveLock || this._sensitiveOperations.size) throw new Error("Life cycle change unavailable at this time");
        this._exclusiveLock = true;
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
            this._exclusiveLock = false;
        }
    }

    beginSensitiveOperation(id: string) {
        // If a life cycle change is in progress, we want to reject any attempt to start a sensitive operation
        if (this._exclusiveLock) throw new Error("Life cycle change in progress");
        if (this._sensitiveOperations.has(id)) throw new Error("This operation is already in progress");
        this._sensitiveOperations.add(id);

        // We return a release function to ensure that it is only possible to decrement the lock once per operation
        let lifeCycle = this;
        return () => {
            if (!lifeCycle) throw new Error("Operation has already signaled completion");
            lifeCycle._sensitiveOperations.delete(id);
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
