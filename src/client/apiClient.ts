import * as api from "../common/api";
import { IApiClient } from "./client";

function isSuccess(status: number) {
    return 200 <= status && status <= 299;
}

function  isNotSuccess(status: number) {
    return !isSuccess(status);
}

function ensureSucces(status: number) {
    if (isNotSuccess(status)) throw new Error(`HTTP request failed ${status}`);
}

export class ApiClient implements IApiClient {
    private _client = new XMLHttpRequest();
    private _callback: (err: Error, status?: number, result?: any)=>void = null;

    constructor(readonly pathRoot: string) {
        this._client.onload = () => {
            if (!this._callback) return;

            try {
                ensureSucces(this._client.status);
                const json = this._client.responseText ? JSON.parse(this._client.responseText) : {};
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

    ensureIdle(): Promise<void> {
        return new Promise((resolve, reject) => {
            const start = new Date();
            const check = () => {
                if (this.isBusy) {
                    const timeMs = new Date().getTime() - start.getTime();
                    if (timeMs < 30000) {
                        // Allow a tick of the event loop before checking again
                        window.requestAnimationFrame(check);
                    }
                    else {
                        reject(new Error("Timed out waiting for previous request to complete"));
                    }
                }
                else {
                    resolve();
                }
            };
            check();
        });
    }

    private registerAwaiter<T>(resolve: (value:T)=>void, reject: (erro:Error)=>void) {
        this._callback = (err, status, result) => {
            if (err)
                reject(err);
            else if (isNotSuccess(status))
                reject(new Error(`HTTP request failed with status ${status}`));
            else
                resolve(result);
        };
    }

    private async request<T>(method: string, path: string, data?: any): Promise<T> {
        await this.ensureIdle();
        return new Promise((resolve, reject) => {
            try {
                path = this.getFullPath(path);
                this.registerAwaiter(resolve, reject);
                this._client.open(method, path);
                this._client.setRequestHeader("content-type", "application/json; charset=utf-8");

                if (data) data = JSON.stringify(data);
                this._client.send(data);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    getConfig() {
        return this.request("GET", "/config");
    }

    getLocos(): Promise<api.Loco[]> {
        return this.request("GET", "/locos");
    }

    addLoco(name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<api.Loco> {
        const request: api.Loco = {
            name: name,
            address: address,
            discrete: Array.isArray(speed),
            functions: functions,
            cvs: cvs
        };

        if (Array.isArray(speed)) {
            request.speeds = speed;
        }
        else {
            request.maxSpeed = speed;
        }

        return this.request<api.Loco>("POST", "/locos", request);
    }

    getLoco(id: number): Promise<api.Loco> {
        return this.request("GET", `/locos/${id}`);
    }

    deleteLoco(id: number): Promise<void> {
        return this.request("DELETE", `/locos/${id}`);
    }

    updateLoco(id: number, name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<void> {
        const request: api.Loco = {
            id: id,
            name: name,
            address: address,
            discrete: Array.isArray(speed),
            functions: functions,
            cvs: cvs
        };

        if (Array.isArray(speed)) {
            request.speeds = speed;
        }
        else {
            request.maxSpeed = speed;
        }

        return this.request("POST", `/locos/${id}`, request);
    }
}