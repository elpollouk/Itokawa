import { Bindable } from "./utils/bindable";
import * as messages from "../common/messages"
import { timestamp } from "../common/time";
import { CommandStationState } from "../devices/commandStations/commandStation";
import { RequestCallback, ConnectionState, ICommandConnection, client } from "./client";

const HEARTBEAT_TIME = 15; // In seconds

export class CommandConnection extends Bindable implements ICommandConnection {

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

    state = ConnectionState.Closed;
    deviceState = CommandStationState.NOT_CONNECTED;
    publicUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

    private _socket: WebSocket;
    private _callback: RequestCallback = null;
    private _callbackTag: string = null;
    private _heartbeartToken: any = null;
    private _lastHeatbeatResponse: messages.LifeCyclePingResponse = null;

    get isIdle() {
        return this.state === ConnectionState.Idle;
    }

    get packageVersion(): string {
        const info = this._lastHeatbeatResponse;
        return info ? info.packageVersion : "";
    }

    get deviceId(): string {
        const info = this._lastHeatbeatResponse;
        return info ? info.commandStation : "";
    }

    get gitRevision(): string {
        const info = this._lastHeatbeatResponse;
        return info ? info.gitrev : "";
    }

    constructor(readonly url: string) {
        super();
        this.makeBindableProperty(
            "state",
            "deviceState",
            "publicUrl"
        );
        this._retry();
    }

    request<T>(type: messages.RequestType, data: T, callback?: RequestCallback) {
        try {
            if (!this.isIdle) {
                // The connection is busy, so wait a frame and try again
                window.requestAnimationFrame(() => this.request<T>(type, data, callback));
                return;
            }

            this.state = ConnectionState.Busy;
            this._cancelHeartbeat();

            const message: messages.TransportMessage = {
                type: type,
                requestTime: timestamp(),
                tag: messages.generateMessageTag(),
                data: data
            };
            this._send(message);
            this._callback = callback;
            this._callbackTag = message.tag;
        }
        catch (ex) {
            if (callback) callback(ex);
        }
    }

    sendResponse(tag: string, data?: any) {
        this._send({
            type: messages.RequestType.CommandResponse,
            requestTime: timestamp(),
            tag: tag,
            data: data
        });
    }

    _send(message: messages.TransportMessage) {
        this._socket.send(JSON.stringify(message));
    }

    private _retry() {
        if (this._socket) throw new Error("Socket already open");

        this._socket = new WebSocket(CommandConnection.relativeUri(this.url));
        this._socket.onopen = (ev) => this._onOpen(ev);
        this._socket.onmessage = (message) => this._onMessage(message);
        this._socket.onclose = (ev) => this._onClose(ev);
        this._socket.onerror = (ev) => this._onError(ev);

        this.state = ConnectionState.Opening;
    }

    /*private _close() {
        this._cancelHeartbeat();
        this.state = ConnectionState.Closed;
        if (this._socket) this._socket.close();
    }*/

    private _onOpen(ev: Event) {
        console.log("WebSocket opened");
        this.state = ConnectionState.Idle;
        if (this.isIdle) this._requestHeartbeat();
    }

    private _onClose(ev: CloseEvent) {
        console.log("WebSocket closed");

        this._cancelHeartbeat();

        const prevState = this.state;
        if (prevState !== ConnectionState.Closed) {
            console.error("Unexpected close, scheduling retry attempt...");
            this.state = ConnectionState.Errored;
            this._scheduleHeartbeat();
        }
        this.deviceState = CommandStationState.NOT_CONNECTED;
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
        this.state = ConnectionState.Errored;

        const cb = this._callback;
        this._callback = null;
        if (prevState === ConnectionState.Busy && cb) {
            cb(new Error("WebSocket error encountered"));
        }

        this._cancelHeartbeat();
        this._scheduleHeartbeat();
    }

    private _onMessage(ev: MessageEvent) {
        const message = JSON.parse(ev.data) as messages.TransportMessage;
        if (message.type === messages.RequestType.CommandResponse) {
            const data = message.data as messages.CommandResponse;
            let error: Error;
            if (data.error) {
                console.error(data.error);
                error = new Error(data.error);
            }
            const cb = this._callbackTag === message.tag ? this._callback : null;

            // We want to clear state out before firing the callback so that the callback has the option
            // to issue a new request immediately
            if (data.lastMessage) {
                this.state = ConnectionState.Idle;
                this._callback = null;
                this._scheduleHeartbeat();
            }

            if (cb) cb(error, data);
        }
        else {
            this.emit("message", message);
        }
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
            this._retry();
            return;
        }

        this.request<messages.LifeCycleRequest>(messages.RequestType.LifeCycle, {
            action: messages.LifeCycleAction.ping
        }, (err, response) => {
            if (err) this._onError(err);
            else {
                this._lastHeatbeatResponse = response as messages.LifeCyclePingResponse;
                this.publicUrl = this._lastHeatbeatResponse.publicUrl;
                this.deviceState = this._lastHeatbeatResponse.commandStationState;
                client.isSignedIn = this._lastHeatbeatResponse.isSignedIn;
            }
        });
    }
}