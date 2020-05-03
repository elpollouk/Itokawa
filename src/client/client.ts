import { CommandConnection } from "./commandConnection";
import { DemoCommandConnection } from "./demo/demoCommandConnection";
import { ApiClient } from "./apiClient";
import { DemoApiClient } from "./demo/demoApiClient";
import * as api from "../common/api";
import * as messages from "../common/messages";
import { IBindable } from "./utils/bindable";
import { CommandStationState } from "../devices/commandStations/commandStation";

export interface IApiClient {
    getLocos(): Promise<api.Loco[]>;
    addLoco(name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<api.Loco>;
    getLoco(id: number): Promise<api.Loco>;
    deleteLoco(id: number): Promise<void>;
    updateLoco(id: number, name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<void>;
}

export type RequestCallback = (err: Error, response?: messages.CommandResponse)=>void;

export enum ConnectionState {
    Opening,
    Idle,
    Busy,
    Closed,
    Errored
}

export interface ICommandConnection extends IBindable{
    packageVersion: string;
    deviceId: string;
    gitRevision: string;
    state: ConnectionState;
    deviceState: CommandStationState;
    publicUrl: string;

    request<T>(type: messages.RequestType, data: T, callback?: RequestCallback): void;
    sendResponse(tag: string, data?: any): void;
}

export class Client {
    readonly connection: ICommandConnection;
    readonly api: IApiClient;

    constructor() {
        if (window.location.search === "?demo") {
            this.connection = new DemoCommandConnection();
            this.api = new DemoApiClient();
        }
        else {
            this.connection = new CommandConnection("/control/v1");
            this.api = new ApiClient("/api/v1");
        }
    }
}

export const client = new Client();