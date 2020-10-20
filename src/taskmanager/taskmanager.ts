export type OnProgressCallback = (progress: TaskProgress) => void;
export type TaskFactory = (id: number, params: any) => Promise<ITask>;
export type SubscriptionHandle = any;

export interface TaskProgress {
    id: number;
    finished: boolean;
    out?: string;
    error?: string;
    progress?: number;
    progressTarget?: number;
}

export interface ITask {
    readonly id: number;
    readonly name: string;

    cancel(): Promise<void>;
    wait(): Promise<void>;
    subscribe(onProgress: OnProgressCallback): SubscriptionHandle;
    unsubscribe(handle: SubscriptionHandle): void;
}

export abstract class TaskBase implements ITask {
    private readonly _taskResolve: Set<() => void> = new Set<() => void>();
    private readonly _taskReject: Set<(error: Error) => void> = new Set<(error: Error) => void>();
    private _finalResult: TaskProgress = null;
    private readonly _listeners: Set<OnProgressCallback>;

    protected constructor(readonly id: number, readonly name: string) {
        this._listeners = new Set<OnProgressCallback>();
    }

    protected abstract _onCancel();

    cancel(): Promise<void> {
        !this._finalResult && this._onCancel();
        return this.wait();
    }

    wait(): Promise<void> {
        // We create a promise on demand each time to avoid the need to swallow errors if we create
        // a single promise up front
        return new Promise<void>((resolve, reject) => {
            if (this._finalResult) {
                this._handleFinalProgress(resolve, reject);
            }
            else {
                this._taskResolve.add(resolve);
                this._taskReject.add(reject);
            }
        })
    }

    private _handleFinalProgress(resolve: ()=>void, reject: (error:Error)=>void) {
        if (this._finalResult.error) {
            reject(new Error(this._finalResult.error));
        }
        else {
            resolve();
        }
    }

    private _resolve() {
        for (const resolve of this._taskResolve) resolve();
    }

    private _reject(error: Error) {
        for (const reject of this._taskReject) reject(error);
    }

    protected _onProgress(progress: TaskProgress) {
        if (this._finalResult) throw new Error("Task has already finished");
        if (progress.id !== this.id) throw new Error("Invalid task id provided for progress");

        for (const listener of this._listeners) listener(progress);
        if (progress.finished) {
            this._finalResult = progress;
            this._handleFinalProgress(() => this._resolve(), (e) => this._reject(e));
        }
    }

    protected _fail(message: string) {
        this._onProgress({
            id: this.id,
            finished: true,
            error: message
        });
    }

    subscribe(onProgress: OnProgressCallback) {
        this._listeners.add(onProgress);
        if (this._finalResult) process.nextTick(() => onProgress(this._finalResult));
        return onProgress;
    }

    unsubscribe(handle: SubscriptionHandle): void {
        this._listeners.delete(handle);
    }
}

export class TaskManager {
    registerTask(name: string, factory: TaskFactory) {

    }

    async startTask(name: string, params?: any) {

    }

    listTasks() {

    }

    getTask(id: number) {

    }
}
