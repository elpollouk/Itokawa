import { Bindable } from "../utils/bindable";
import { ICommandConnection, ConnectionState, RequestCallback } from "../client";
import { RequestType, CommandResponse, LocoSpeedRequest, TransportMessage, generateMessageTag, CvValuePair, LocoCvReadRequest, LocoCvWriteRequest, LocoFunctionRequest, FunctionAction, LocoSpeedRefreshRequest, LocoFunctionRefreshRequest } from "../../common/messages";
import { timestamp } from "../../common/time";
import { CommandStationState } from "../../devices/commandStations/commandStation";
import { timeout } from "../../utils/promiseUtils";
const config = require('./config.json');

const CV_ACCESS_TIME = 1.0;

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
    private _functionStates = new Map<number, Map<number, boolean>>();
    private _cvs = new Map<number, number>([
        [1, 3],
        [3, 5],
        [4, 5],
        [7, 200],
        [8, 255],
        [10, 128],
        [29, 6]
    ]);

    constructor() {
        super();
        this.publicUrl = window.location.href;

        this.makeBindableProperty(
            "state",
            "deviceState",
            "publicUrl"
        );

        this._loadCVs();
    }

    private _loadCVs() {
        const json = window.sessionStorage.getItem("cvs");
        if (!json) return;
        const data = JSON.parse(json);
        this._cvs = new Map<number, number>(data);
    }

    private _saveCVs() {
        const data: number[][] = [];
        this._cvs.forEach((value, cv) => data.push([cv, value]));
        window.sessionStorage.setItem("cvs", JSON.stringify(data));
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

            case RequestType.LocoFunction:
                this._handleLocoFunction(rawData as LocoFunctionRequest, callback);
                break;

            case RequestType.EmergencyStop:
                this._handleEmergencyStop(callback);
                break;

            case RequestType.LocoSpeedRefresh:
                this._handleLocoSpeedRefresh(callback);
                break;

            case RequestType.LocoFunctionRefresh:
                this._handleLocoFunctionRefresh(rawData as LocoFunctionRefreshRequest, callback);
                break;

            case RequestType.LocoCvRead:
                this._handleLocoCvRead(rawData as LocoCvReadRequest, callback);
                break;

            case RequestType.LocoCvWrite:
                this._handleLocoCvWrite(rawData as LocoCvWriteRequest, callback);
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
        });
    }

    private _handleLocoFunction(request: LocoFunctionRequest, callback: RequestCallback) {
        this.state = ConnectionState.Busy;

        const isStatefulAction = request.action !== FunctionAction.Trigger;
        if (isStatefulAction) {
            let functionMap = this._functionStates.get(request.locoId);
            if (!functionMap) {
                functionMap = new Map<number, boolean>();
                this._functionStates.set(request.locoId, functionMap);
            }
            functionMap.set(request.function, request.action === FunctionAction.LatchOn);
        }

        setImmediate(() => {
            this.state = ConnectionState.Idle;
            callback(null, {
                lastMessage: true,
                data: "OK"
            });
            if (!isStatefulAction) return;

            this.emit("message", {
                tag: generateMessageTag(),
                requestTime: timestamp(),
                type: RequestType.LocoFunction,
                data: request
            } as TransportMessage);
        });
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

    private _handleLocoFunctionRefresh(request: LocoSpeedRefreshRequest, callback: RequestCallback) {
        this.state = ConnectionState.Idle;

        setImmediate(() => {
            const functionMap = this._functionStates.get(request.locoId);
            if (functionMap) {
                for (const [func, state] of functionMap.entries()) {
                    callback(null, {
                        lastMessage: false,
                        data: {
                            locoId: request.locoId,
                            function: func,
                            action: state ? FunctionAction.LatchOn : FunctionAction.LatchOff
                        }
                    });
                }
            }

            callback(null, {
                lastMessage: true,
                data: "OK"
            });
        });
    }

    private async _handleLocoCvRead(request: LocoCvReadRequest, callback: RequestCallback) {
        this.state = ConnectionState.Busy;

        try {
            for (const requestedCV of request.cvs) {
                await timeout(CV_ACCESS_TIME);

                let value = 0;
                if (this._cvs.has(requestedCV)) value = this._cvs.get(requestedCV);

                callback(null, {
                    lastMessage: false,
                    data: {
                        cv: requestedCV,
                        value: value
                    } as CvValuePair
                });
            }

            callback(null, {
                lastMessage: true,
                data: "OK"
            });
        }
        catch(error) {
            callback(error);
        }

        this.state = ConnectionState.Idle;
    }

    private async _handleLocoCvWrite(request: LocoCvWriteRequest, callback: RequestCallback) {
        this.state = ConnectionState.Busy;

        try {
            for (const pair of request.cvs) {
                await timeout(CV_ACCESS_TIME);

                this._cvs.set(pair.cv, pair.value);
                callback(null, {
                    lastMessage: false,
                    data: pair
                });
            }

            callback(null, {
                lastMessage: true,
                data: "OK"
            })

            this._saveCVs();
        }
        catch (error) {
            callback(error);
        }

        this.state = ConnectionState.Idle;
    }
}