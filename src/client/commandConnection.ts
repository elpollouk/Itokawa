import { CommandRequest, CommandResponse } from "../common/messages"
import { toHumanHex } from "../utils/hex";

type RequestCallback = (err: Error, response?: CommandResponse)=>void

export enum ConnectionState {
    Opening,
    Idle,
    Busy,
    Closed,
    Errored
}

export class CommandConnection {

    static relativeUri(path: string): string {
        const loc = window.location;
        let new_uri: string;
        if (loc.protocol === "https:") {
            new_uri = "wss:";
        } else {
            new_uri = "ws:";
        }
        new_uri += "//" + loc.host;
        if (path[0] !== "/") new_uri += loc.pathname
        new_uri += path;

        return new_uri;
    }

    private _socket: WebSocket;
    private _callback: RequestCallback = null;
    private _state: ConnectionState = ConnectionState.Opening;

    get state() {
        return this._state;
    }

    get isIdle() {
        return this.state === ConnectionState.Idle;
    }

    constructor(readonly url: string) {
        this._socket = new WebSocket(CommandConnection.relativeUri(url));
        this._socket.onopen = (ev) => this.onOpen(ev);
        this._socket.onmessage = (message) => this.onMessage(message);
        this._socket.onclose = (ev) => this.onClose(ev);
        this._socket.onerror = (ev) => this.onError(ev);
    }

    private _setState(state: ConnectionState) {
        this._state = state;
    }

    request(message: CommandRequest, callback: RequestCallback): RequestCallback {
        try {
            if (!this.isIdle) throw new Error("Request already in progress");
            this._setState(ConnectionState.Busy);

            this._socket.send(JSON.stringify(message));
            this._callback = callback;

            return this._callback;
        }
        catch (ex) {
            callback(ex);
            return null;
        }
    }

    private onOpen(ev: Event) {
        console.log("WebSocket opened");
        this._setState(ConnectionState.Idle);
    }

    private onClose(ev: CloseEvent) {
        console.log("WebSocket clossed");

        const prevState = this.state;
        this._setState(ConnectionState.Closed);

        const cb = this._callback;
        this._callback = null;
        if (prevState === ConnectionState.Busy && cb) {
            cb(new Error("Connection closed"));
        }
    }

    private onError(ev: Event) {
        console.error("WebSocket error");

        const prevState = this.state;
        this._setState(ConnectionState.Errored);

        const cb = this._callback;
        this._callback = null;
        if (prevState === ConnectionState.Busy && cb) {
            cb(new Error("WebSocket error encountered"));
        }
    }

    private onMessage(message: MessageEvent) {
        console.log(`WebSocket message received: ${message.data}`);

        if (this.state === ConnectionState.Busy) {
            this._setState(ConnectionState.Idle);
            const cb = this._callback;
            this._callback = null;

            if (cb) cb(null, JSON.parse(message.data));
        }
    }
}