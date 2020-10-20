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
    private readonly _taskPromise: Promise<void>;
    private _taskResolve: () => void;
    private _taskReject: (error: Error) => void;
    private _finalResult: TaskProgress = null;
    private readonly _listeners: Set<OnProgressCallback>;

    protected constructor(readonly id: number, readonly name: string) {
        this._taskPromise = new Promise((resolve, reject) => {
            this._taskResolve = resolve;
            this._taskReject = reject;
        });
        // This is to prevent errors related to consumers who only use the subscription interface
        this._taskPromise.catch(() => {});
        this._listeners = new Set<OnProgressCallback>();
    }

    protected abstract _onCancel();

    cancel(): Promise<void> {
        !this._finalResult && this._onCancel();
        return this.wait();
    }

    wait(): Promise<void> {
        return this._taskPromise;
    }

    protected _onProgress(progress: TaskProgress) {
        if (this._finalResult) throw new Error("Task has already finished");
        if (progress.id !== this.id) throw new Error("Invalid task id provided for progress");

        for (const listener of this._listeners) listener(progress);
        if (progress.finished) {
            this._finalResult = progress;
            if (progress.error) {
                this._taskReject(new Error(progress.error));
            }
            else {
                this._taskResolve();
            }
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
