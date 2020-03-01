import { Bindable } from "../utils/bindable";
import { ICommandConnection, ConnectionState, RequestCallback } from "../client";
import { RequestType, CommandResponse, LocoSpeedRequest, TransportMessage, generateMessageTag } from "../../common/messages";
import { timestamp } from "../../common/time";
import { CommandStationState } from "../../devices/commandStations/commandStation";
const config = require('./config.json');

function _defaultCallback(err: Error, message: CommandResponse) {

}

interface LocoState {
    speed: number;
    reverse: boolean;
}

export class DemoCommandConnection extends Bindable implements ICommandConnection {
    packageVersion = config.packageVersion;
    deviceId = config.deviceId;
    gitRevision = config.gitRevision;
    state = ConnectionState.Idle;
    deviceState = CommandStationState.IDLE;
    publicUrl: string;

    private _locoStates = new Map<number, LocoState>();

    constructor() {
        super();
        this.publicUrl = `${window.location.protocol}//${window.location.hostname}`;
        if (window.location.port) {
            this.publicUrl += `:${window.location.port}`;
        }

        this.makeBindableProperty(
            "state",
            "deviceState",
            "publicUrl"
        );
    }

    request<T>(type: RequestType, data: T, callback?: RequestCallback): void {
        const rawData = data as unknown;
        callback = callback || _defaultCallback;
        switch (type) {
            case RequestType.LifeCycle:
                callback(new Error("Server control disabled in demo mode"));
                break;

            case RequestType.LocoSpeed:
                this._handleLocoSpeed(rawData as LocoSpeedRequest, callback);
                break;

            case RequestType.EmergencyStop:
                this._handleEmergencyStop(callback);
                break;

            case RequestType.LocoSpeedRefresh:
                this._handleLocoSpeedRefresh(callback);
                break;

            default:
                callback(new Error(`Unrecognised request type: ${type}`));
        }
    }

    sendResponse(tag: string, data?: any): void {
        throw new Error("Method not implemented.");
    }

    private _handleLocoSpeed(request: LocoSpeedRequest, callback: RequestCallback) {
        this.state = ConnectionState.Busy;

        this._locoStates.set(request.locoId, {
            speed: request.speed,
            reverse: request.reverse
        });

        setImmediate(() => {
            this.state = ConnectionState.Idle;
            callback(null, {
                lastMessage: true,
                data: "OK"
            });
            this.emit("message", {
                tag: generateMessageTag(),
                requestTime: timestamp(),
                type: RequestType.LocoSpeed,
                data: request
            } as TransportMessage);
        })
    }

    private _handleEmergencyStop(callback: RequestCallback) {
        this.state = ConnectionState.Busy;

        for (const loco of this._locoStates.values()) {
            loco.speed = 0;
            loco.reverse = false;
        }

        setImmediate(() => {
            this.state = ConnectionState.Idle;

            callback(null, {
                lastMessage: true,
                data: "OK"
            });

            for (const loco of this._locoStates) {
                this.emit("message", {
                    tag: generateMessageTag(),
                    requestTime: timestamp(),
                    type: RequestType.LocoSpeed,
                    data: {
                        locoId: loco[0],
                        speed: loco[1].speed,
                        reverse: loco[1].reverse
                    }
                } as TransportMessage);
            }
        });
    }

    private _handleLocoSpeedRefresh(callback: RequestCallback) {
        this.state = ConnectionState.Idle;

        setImmediate(() => {
            for (const loco of this._locoStates) {
                callback(null, {
                    lastMessage: false,
                    data: {
                        locoId: loco[0],
                        speed: loco[1].speed,
                        reverse: loco[1].reverse
                    }
                });
            }

            callback(null, {
                lastMessage: true,
                data: "OK"
            });
        });
    }
}