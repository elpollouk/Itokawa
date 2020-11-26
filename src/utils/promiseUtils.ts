import e = require("express");

export class OutArg<T> {
    value: T;
}

export type CancelFunc = () => void;
export type OutCancelFunc = OutArg<CancelFunc>;

function createCancel(cancel: OutCancelFunc, cancelAction: () => void) {
    if (cancel) cancel.value = cancelAction;
}

export function timeout(seconds: number, cancel?: OutCancelFunc): Promise<void> {
    return new Promise((resolve, reject) => {
        const token = setTimeout(resolve, seconds * 1000);
        createCancel(cancel, () => {
            clearTimeout(token);
            reject(new Error("Cancelled"));
        });
    });
}

export function firedEvent(source: NodeJS.EventEmitter, event: string | symbol, ...desiredArgs: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
        if (desiredArgs[0] instanceof(OutArg))
            var cancel = desiredArgs.shift() as OutCancelFunc;

        function handler(...actualArgs: any[]) {
            if (desiredArgs.length > actualArgs.length) return;
            for (let i = 0; i < desiredArgs.length; i++)
                if (desiredArgs[i] != actualArgs[i])
                    return;

            source.off(event, handler);
            resolve();
        };

        createCancel(cancel, () => {
            source.off(event, handler);
            reject(new Error("Cancelled"));
        });

        source.on(event, handler);
    });
}

export function nextTick(): Promise<void> {
    return new Promise((resolve) => {
        process.nextTick(resolve);
    });
}

export class SignalablePromise<T = void> implements Promise<T> {
    private readonly _promise: Promise<T>;
    private _resolve: (result?: T | PromiseLike<T>) => void;
    private _reject: (reason?: any) => void;

    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2> {
        return this._promise.then(onfulfilled, onrejected);
    }

    catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult> {
        return this._promise.catch(onrejected);
    }

    [Symbol.toStringTag]: string;
    finally(onfinally?: () => void): Promise<T> {
        return this._promise.finally(onfinally);
    }

    resolve(result?: T | PromiseLike<T>) {
        this._resolve(result);
    }

    reject(reason?: any) {
        this._reject(reason);
    }
}
