type ValueCallback<T> = (newValue:T, oldValue?: T)=>void;

export class Bindable {
    _events:{ [key: string]: ValueCallback<any> } = {}

    constructor () {

    }

    bind<T>(name: string, cb: ValueCallback<T>) {
        this._events[name] = cb;
        if (cb) cb(this[name]);
    }

    makeBindableProperty<T>(...names: string[]) {
        for (const name of names) {
            const privateName = "_" + name;
        
            const currentValue = this[name];
            this[privateName] = currentValue;
            this._events[name] = null;
            delete this[name];
        
            Object.defineProperty(this, name, {
                get: function(): T { 
                    return this[privateName]; 
                },
                set: function(value: T) {
                    const oldValue = this[privateName];
                    if (value === oldValue) return;
                    this[privateName] = value;
                    const cb = this._events[name];
                    if (cb) cb(value, oldValue);
                },
            });
        }
    }
}