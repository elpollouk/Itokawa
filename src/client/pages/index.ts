import { Client } from "../client";
import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { TrainControl } from "../controls/trainControl";
import { RequestType } from "../../common/messages";
import { Loco } from "../../common/api";
import { parseHtml, getById } from "../utils/dom";
import { ConnectionState } from "../commandConnection";
import { TrainRosterConstructor } from "./trainRoster";
const html = require("./index.html");

class IndexPage extends Page {
    path: string = IndexPageConstructor.path;    
    content: HTMLElement;
    private _trainControls: HTMLElement;

    constructor() {
        super();
        this.content = this._buildUi();
    }

    _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._trainControls = getById(page, "trains");
        getById(page, "emergencyStop").onclick = () => this._emergencyStop();
        getById(page, "add").onclick = () => nav.open(TrainRosterConstructor.path);
        
        return page;
    }

    onEnter() {
        Client.instance.api.getLocos().then((result: Loco[]) => {
            this._trainControls.innerHTML = "";
            if (result.length) {
                for (const loco of result) {
                    new TrainControl(this._trainControls, loco);
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

        connection.request({
            type: RequestType.EmergencyStop
        });
    }
}

export const IndexPageConstructor: IPageConstructor = {
    path: "index",
    create: () => new IndexPage()
}