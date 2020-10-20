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
    readonly progress: TaskProgress;

    cancel(): Promise<void>;
    wait(): Promise<void>;
    subscribe(onProgress: OnProgressCallback): SubscriptionHandle;
    unsubscribe(handle: SubscriptionHandle): void;
}

export abstract class TaskBase implements ITask {
    private readonly _taskResolve: Set<() => void> = new Set();
    private readonly _taskReject: Set<(error: Error) => void> = new Set();
    private _lastProgress: TaskProgress;
    private readonly _listeners: Set<OnProgressCallback>;

    get progress() { return this._lastProgress; }

    protected constructor(readonly id: number, readonly name: string) {
        this._listeners = new Set<OnProgressCallback>();
        this._lastProgress = {
            id: id,
            finished: false
        }
    }

    protected abstract _onCancel();

    cancel(): Promise<void> {
        !this._lastProgress.finished && this._onCancel();
        return this.wait();
    }

    wait(): Promise<void> {
        // We create a promise on demand each time to avoid the need to swallow errors if we create
        // a single promise up front
        return new Promise<void>((resolve, reject) => {
            if (this._lastProgress.finished) {
                this._handleFinalProgress(resolve, reject);
            }
            else {
                this._taskResolve.add(resolve);
                this._taskReject.add(reject);
            }
        })
    }

    private _handleFinalProgress(resolve: ()=>void, reject: (error:Error)=>void) {
        if (this._lastProgress.error) {
            reject(new Error(this._lastProgress.error));
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
        if (this._lastProgress.finished) throw new Error("Task has already finished");
        if (progress.id !== this.id) throw new Error("Invalid task id provided for progress");
        this._lastProgress = progress;

        for (const listener of this._listeners) listener(progress);
        if (progress.finished) {
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
        if (this._lastProgress.finished) process.nextTick(() => onProgress(this._lastProgress));
        return onProgress;
    }

    unsubscribe(handle: SubscriptionHandle): void {
        this._listeners.delete(handle);
    }
}

export class TaskManager {
    private readonly _factories: Map<string, TaskFactory> = new Map();
    private readonly _tasks: Map<number, ITask> = new Map();
    private _nextId = 0;

    registerTaskFactory(name: string, factory: TaskFactory) {
        if (this._factories.has(name)) throw new Error(`Factory '${name}' is already registered`);
        this._factories.set(name, factory);
    }

    async startTask<T = any>(name: string, params?: T): Promise<ITask> {
        const factory = this._factories.get(name);
        if (!factory) throw new Error(`No factory for '${name}' has been registered`);

        const id = this._nextId++;
        const task = await factory(id, params);
        // These are internal verification checks
        if (id !== task.id) throw new Error("Task created with incorrect id");
        if (name !== task.name) throw new Error("Task created with incorrect name");

        this._tasks.set(id, task);
        const removeTask = () => this._tasks.delete(id);
        task.wait().then(removeTask, removeTask);

        return task;
    }

    listTasks(): IterableIterator<ITask> {
        return this._tasks.values();
    }

    getTask(id: number) {
        const task = this._tasks.get(id);
        if (!task) throw new Error(`Task ${id} is not running`);
        return task;
    }
}
