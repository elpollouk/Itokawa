import { CommandConnection } from "./commandConnection";
import { DemoCommandConnection } from "./demo/demoCommandConnection";
import { ApiClient } from "./apiClient";
import { DemoApiClient } from "./demo/demoApiClient";
import * as api from "../common/api";
import * as messages from "../common/messages";
import { IBindable } from "./utils/bindable";
import { CommandStationState } from "../devices/commandStations/commandStation";
import { FeatureFlags } from "../common/featureFlags";
import { PATH_API, PATH_AUTH, PATH_LOGOUT, PATH_WEBSOCKET } from "../common/constants";

export interface IApiClient {
    getConfig(): Promise<api.Config>;
    getLocos(): Promise<api.Loco[]>;
    getLocosOnTrack(): Promise<api.Loco[]>;

    addLoco(name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<api.Loco>;
    getLoco(id: number): Promise<api.Loco>;
    deleteLoco(id: number): Promise<void>;
    updateLoco(id: number, name: string, address: number, speed: number[] | number, functions: api.FunctionConfig[], cvs: api.CvMap): Promise<void>;

    addToTrack(id: number): Promise<void>;
    removeFromTrack(id: number): Promise<void>;
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
    nodeVersion: string;
    state: ConnectionState;
    deviceState: CommandStationState;
    publicUrl: string;

    request<T>(type: messages.RequestType, data: T, callback?: RequestCallback): void;
    sendResponse(tag: string, data?: any): void;
}

export class Client {
    readonly connection: ICommandConnection;
    readonly api: IApiClient;
    readonly featureFlags: FeatureFlags = new FeatureFlags();
    isSignedIn: boolean = false;
    readonly isDemo: boolean;

    constructor() {
        if (window.location.search === "?demo") {
            this.connection = new DemoCommandConnection();
            this.api = new DemoApiClient();
            this.isSignedIn = true;
            this.isDemo = true;
        }
        else {
            this.connection = new CommandConnection(PATH_WEBSOCKET);
            this.api = new ApiClient(PATH_API);
            this.isDemo = false;
        }

        this.api.getConfig().then((config) => {
            if (config.features) this.featureFlags.set(config.features);
        }, (err) => {
            console.error("Failed to retrieve client config");
            console.error(err);
        })
    }

    signIn() {
        window.location.assign(PATH_AUTH);
    }

    signOut() {
        window.location.assign(PATH_LOGOUT);
    }

    requireSignIn(): boolean {
        if (!this.isSignedIn) {
            this.signIn();
            return true;
        }
        return false;
    }
}

export const client = new Client();