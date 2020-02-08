type ValueCallback<T> = (newValue:T, oldValue?: T)=>void;

export class Bindable {
    _bindings: { [key: string]: Set<ValueCallback<any>> } = {}
    _backingStore: { [key: string]: any } = {}

    constructor () {

    }

    bind<T>(name: string, cb: ValueCallback<T>): ValueCallback<T> {
        if (!cb) throw new Error(`No callback provided while attempting to bind to ${name}`);
        const set = this._bindings[name] || new Set<ValueCallback<T>>();
        set.add(cb);
        this._bindings[name] = set;
        cb(this[name]);
        return cb;
    }

    unbind<T>(name: string, cb: ValueCallback<T>) {
        const set = this._bindings[name];
        if (!set || !set.has(cb)) throw new Error(`Callback was not bound to ${name}`);
        set.delete(cb);
    }

    makeBindableProperty(...names: string[]) {
        for (const name of names) {       
            const currentValue = this[name];
            this._backingStore[name] = currentValue;
            delete this[name];
        
            Object.defineProperty(this, name, {
                get: function() { 
                    return this._backingStore[name]; 
                },
                set: function(value) {
                    const oldValue = this._backingStore[name];
                    if (value === oldValue) return;
                    this._backingStore[name] = value;
                    const set = this._bindings[name];
                    if (set) {
                        for (const cb of set) {
                            cb(value, oldValue);
                        }
                    }
                },
            });
        }
    }
}