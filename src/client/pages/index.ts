import { client } from "../client";
import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { TrainControl } from "../controls/trainControl";
import { RequestType, TransportMessage, LocoSpeedRequest } from "../../common/messages";
import { Loco } from "../../common/api";
import { parseHtml, getById } from "../utils/dom";
import { ConnectionState } from "../client";
import { TrainRosterConstructor } from "./trainRoster";
const html = require("./index.html");

class IndexPage extends Page {
    path: string = IndexPageConstructor.path;    
    content: HTMLElement;
    private _trainControlsContainer: HTMLElement;
    private _trainControls: TrainControl[] = [];
    private _messageHandlerToken: any;

    constructor() {
        super();
        this.content = this._buildUi();

        this._messageHandlerToken = client.connection.on("message", (data: TransportMessage) => {
            this._onMessage(data);
        });
    }

    _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._trainControlsContainer = getById(page, "trains");
        getById(page, "emergencyStop").onclick = () => this._emergencyStop();
        getById(page, "add").onclick = () => nav.open(TrainRosterConstructor.path);
        
        return page;
    }

    onEnter() {
        client.api.getLocos().then((result: Loco[]) => {
            this._trainControlsContainer.innerHTML = "";
            if (result.length) {
                for (const loco of result) {
                    this._trainControls.push(
                        new TrainControl(this._trainControlsContainer, loco)
                    );
                }
            }
            else {
                this.content.classList.add("noTrains");
            }
            this.content.classList.remove("loading");
        }).then(() => {
            // We want to request the latest loco states as another client may have changed them while we
            // were off this page.
            client.connection.request(RequestType.LocoSpeedRefresh, null, (err, response) => {
                if (err) {
                    prompt.error(`Failed to refresh loco speeds:\n${err.message}`);
                    return;
                }
                if (response.lastMessage) return; // The last message is just "OK"
                const data = response.data as LocoSpeedRequest;
                this._updateSpeed(data);
            });
        }).catch((err) => {
            console.error(err);
            prompt.error(`Failed to load train list.\n${err.message}`);
        });
    }

    private _emergencyStop() {
        const connection = client.connection;
        if (connection.state !== ConnectionState.Idle) {
            setTimeout(() => this._emergencyStop(), 100);
            return;
        }

        connection.request(RequestType.EmergencyStop, null);
    }

    private _updateSpeed(request: LocoSpeedRequest) {
        for (const control of this._trainControls) {
            if (control.loco.address === request.locoId) {
                control.updateSpeed(request.speed, request.reverse);
            }
        }
    }

    private _onMessage(message: TransportMessage) {
        if (message.type !== RequestType.LocoSpeed) return;
        const request = message.data as LocoSpeedRequest;
        this._updateSpeed(request);
    }

    destroy() {
        client.connection.off("message", this._messageHandlerToken);
        super.destroy();
    }
}

export const IndexPageConstructor: IPageConstructor = {
    path: "index",
    create: () => new IndexPage()
}