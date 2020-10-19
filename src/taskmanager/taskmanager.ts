
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
    private readonly _listeners: Set<OnProgressCallback>;

    protected constructor(readonly id: number, readonly name: string) {
        this._taskPromise = new Promise((resolve, reject) => {
            this._taskResolve = resolve;
            this._taskReject = reject;
        });
        this._listeners = new Set<OnProgressCallback>();
    }

    protected abstract _onCancel();

    cancel(): Promise<void> {
        this._onCancel();
        return this.wait();
    }

    wait(): Promise<void> {
        return this._taskPromise;
    }

    protected _onProgress(progress: TaskProgress) {
        if (progress.id !== this.id) throw new Error("Invalid task id provided for progress");
        for (const listener of this._listeners) listener(progress);
        if (progress.finished) {
            if (progress.error) {
                this._taskReject(new Error(progress.error));
            }
            else {
                this._taskResolve();
            }
        }
    }

    subscribe(onProgress: OnProgressCallback) {
        this._listeners.add(onProgress);
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
