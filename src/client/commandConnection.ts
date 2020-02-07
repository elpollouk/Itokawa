import * as messages from "../common/messages"
import { timestamp } from "../common/time";
import { CommandStationState } from "../devices/commandStations/commandStation";

const HEARTBEAT_TIME = 15; // In seconds

type RequestCallback = (err: Error, response?: messages.CommandResponse)=>void
type ValueCallback<T> = (value:T)=>void;

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
    private _deviceState: CommandStationState = CommandStationState.NOT_CONNECTED;
    private _heartbeartToken: any = null;
    private _lastHeatbeatResponse: messages.LifeCyclePingResponse = null;
    private _publicUrl: string = `${window.location.protocol}://${window.location.hostname}:${window.location.port}`;
    private _onPublicUrlChanged: ValueCallback<string>;
    private _onStateChanged: ValueCallback<ConnectionState>;
    private _onDeviceStateChanged: ValueCallback<CommandStationState>;

    get state() {
        return this._state;
    }

    get isIdle() {
        return this.state === ConnectionState.Idle;
    }

    get deviceId(): string {
        const info = this._lastHeatbeatResponse;
        return info ? info.commandStation : "";
    }

    get deviceState(): CommandStationState {
        return this._deviceState;
    }

    get gitRevision(): string {
        const info = this._lastHeatbeatResponse;
        return info ? info.gitrev : "";
    }

    get publicUrl(): string {
        return this._publicUrl;
    }

    set onPublicUrlChanged(value: ValueCallback<string>) {
        this._onPublicUrlChanged = value;
        if (value) {
            value(this._publicUrl);
        }
    }

    private _setPublicUrl(url: string) {
        if (url === this._publicUrl) return;
        this._publicUrl = url;
        if (this._onPublicUrlChanged) this._onPublicUrlChanged(url);
    }

    set onStateChanged(value: ValueCallback<ConnectionState>) {
        this._onStateChanged = value;
        if (value) {
            value(this._state);
        }
    }

    private _setState(state: ConnectionState) {
        if (state === this._state) return;
        this._state = state;
        if (this._onStateChanged) this._onStateChanged(state);
    }

    set onDeviceStateChanged(value: ValueCallback<CommandStationState>) {
        this._onDeviceStateChanged = value;
        if (value) {
            value(this._deviceState);
        }
    }

    private _setDeviceState(state: CommandStationState) {
        if (state === this._deviceState) return;
        this._deviceState = state;
        if (this._onDeviceStateChanged) this._onDeviceStateChanged(state);
    }

    constructor(readonly url: string) {
        this.retry();
    }

    request(message: messages.CommandRequest, callback?: RequestCallback) {
        try {
            if (!this.isIdle) throw new Error("Request already in progress");
            this._setState(ConnectionState.Busy);
            this._cancelHeartbeat();

            message.requestTime = timestamp();
            this._socket.send(JSON.stringify(message));
            this._callback = callback;
        }
        catch (ex) {
            callback(ex);
        }
    }

    retry() {
        if (this._socket) throw new Error("Socket already open");

        this._socket = new WebSocket(CommandConnection.relativeUri(this.url));
        this._socket.onopen = (ev) => this._onOpen(ev);
        this._socket.onmessage = (message) => this._onMessage(message);
        this._socket.onclose = (ev) => this._onClose(ev);
        this._socket.onerror = (ev) => this._onError(ev);

        this._state = ConnectionState.Opening;
    }

    close() {
        this._cancelHeartbeat();
        this._setState(ConnectionState.Closed);
        if (this._socket) this._socket.close();
    }

    private _onOpen(ev: Event) {
        console.log("WebSocket opened");
        this._setState(ConnectionState.Idle);
        this._requestHeartbeat();
    }

    private _onClose(ev: CloseEvent) {
        console.log("WebSocket closed");

        this._cancelHeartbeat();

        const prevState = this.state;
        if (prevState !== ConnectionState.Closed) {
            console.error("Unexpected close, scheduling retry attempt...");
            this._setState(ConnectionState.Errored);
            this._scheduleHeartbeat();
        }
        this._setDeviceState(CommandStationState.NOT_CONNECTED);
        this._socket = null;

        const cb = this._callback;
        this._callback = null;
        if (prevState === ConnectionState.Busy && cb) {
            cb(new Error("Connection closed"));
        }
    }

    private _onError(ev: any) {
        console.error("WebSocket error");

        const prevState = this.state;
        this._setState(ConnectionState.Errored);

        const cb = this._callback;
        this._callback = null;
        if (prevState === ConnectionState.Busy && cb) {
            cb(new Error("WebSocket error encountered"));
        }

        this._cancelHeartbeat();
        this._scheduleHeartbeat();
    }

    private _onMessage(message: MessageEvent) {
        console.log(`WebSocket message received: ${message.data}`);

        if (this.state === ConnectionState.Busy) {
            this._setState(ConnectionState.Idle);
            const cb = this._callback;
            this._callback = null;

            if (cb) cb(null, JSON.parse(message.data));
        }
        this._scheduleHeartbeat();
    }

    private _scheduleHeartbeat() {
        if (this._heartbeartToken) throw new Error("Heartbeat already shedulled");

        this._heartbeartToken = setTimeout(() => {

            this._heartbeartToken = null;
            if (this.state === ConnectionState.Busy) return; // Ignore heartbeats if another request is already in progress

            this._requestHeartbeat();

        }, HEARTBEAT_TIME * 1000);
    }

    private _cancelHeartbeat() {
        if (this._heartbeartToken) {
            clearTimeout(this._heartbeartToken);
            this._heartbeartToken = null;
        }
    }

    private _requestHeartbeat() {
        if (!this._socket) {
            this.retry();
            return;
        }

        this.request({
            type: messages.RequestType.LifeCycle,
            action: messages.LifeCycleAction.ping
        } as messages.LifeCycleRequest, (err, response) => {
            if (err) this._onError(err);
            else {
                this._lastHeatbeatResponse = response as messages.LifeCyclePingResponse;
                this._setPublicUrl(this._lastHeatbeatResponse.publicUrl);
                this._setDeviceState(this._lastHeatbeatResponse.commandStationState);
            }
        });
    }
}