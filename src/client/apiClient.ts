function isSuccess(status: number) {
    return 200 <= status && status <= 299;
}

function  isNotSuccess(status: number) {
    return !isSuccess(status);
}

export class ApiClient {
    private _client = new XMLHttpRequest();
    private _callback: (err: Error, status?: number, result?: any)=>void = null;

    constructor(readonly pathRoot: string) {
        this._client.onload = () => {
            if (!this._callback) return;

            try {
                const json = JSON.parse(this._client.responseText);
                this._callback(null, this._client.status, json);
            }
            catch (err) {
                this._callback(err);
            }
            this._callback = null;
        }

        this._client.onerror = () => {
            if (!this._callback) return;

            try {
                this._callback(new Error("HTTP connection failed"));
            }
            catch (err) {
                console.error("Failed reporting HTTP API error");
                console.error(err);
            }

            this._callback = null;
        }
    }

    get isIdle() {
        return !this._callback;
    }

    get isBusy() {
        return !!this._callback;
    }

    getFullPath(path: string) {
        return this.pathRoot + path;
    }

    ensureIdle() {
        if (this.isBusy) throw new Error("API client is currently busy");
    }

    private registerAwaiter(resolve: (value:any)=>void, reject: (erro:Error)=>void) {
        this._callback = (err, status, result) => {
            if (err)
                reject(err);
            else if (isNotSuccess(status))
                reject(new Error(`HTTP request failed with status ${status}`));
            else
                resolve(result);
        };
    }

    getLocos(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const path = this.getFullPath("/locos");
                this.registerAwaiter(resolve, reject);
                this._client.open("GET", path);
                this._client.send();
            }
            catch (err) {
                reject(err);
            }
        });
    }
}