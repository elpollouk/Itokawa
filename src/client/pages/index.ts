import { Client } from "../client";
import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { TrainControl } from "../controls/trainControl";
import { RequestType, TransportMessage, LocoSpeedRequest } from "../../common/messages";
import { Loco } from "../../common/api";
import { parseHtml, getById } from "../utils/dom";
import { ConnectionState } from "../commandConnection";
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

        this._messageHandlerToken = Client.instance.connection.on("message", (data: TransportMessage) => {
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
        Client.instance.api.getLocos().then((result: Loco[]) => {
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
        }).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train list.");
        });
    }

    private _emergencyStop() {
        const connection = Client.instance.connection;
        if (connection.state !== ConnectionState.Idle) {
            setTimeout(() => this._emergencyStop(), 100);
            return;
        }

        connection.request(RequestType.EmergencyStop, null);
    }

    private _onMessage(message: TransportMessage) {
        if (message.type !== RequestType.LocoSpeed) return;
        const request = message.data as LocoSpeedRequest;
        for (const control of this._trainControls) {
            if (control.loco.address === request.locoId) {
                control.updateSpeed(request.speed, request.reverse);
            }
        }
    }

    destroy() {
        Client.instance.connection.off("message", this._messageHandlerToken);
    }
}

export const IndexPageConstructor: IPageConstructor = {
    path: "index",
    create: () => new IndexPage()
}