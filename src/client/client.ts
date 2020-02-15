import { CommandConnection } from "./commandConnection";
import { ApiClient } from "./apiClient";

let _client: Client = null;

export class Client {
    static get instance() {
        return _client;
    }

    readonly connection: CommandConnection;
    readonly api: ApiClient;

    constructor() {
        this.connection = new CommandConnection("/control/v1");
        this.api = new ApiClient("/api/v1");
        _client = this;
    }
}