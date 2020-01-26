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
        process.nextTick(() => resolve());
    });
}