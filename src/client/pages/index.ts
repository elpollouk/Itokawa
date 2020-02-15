import { Client } from "../client";
import { Page, IPageConstructor } from "./page";
import { TrainControl } from "../controls/trainControl";
import { RequestButton } from "../controls/requestButton";
import { CommandRequest, RequestType } from "../../common/messages";
import { Locos } from "../../common/api";

class IndexPage extends Page {
    path: string = IndexPageConstructor.path;    
    content: HTMLElement;
    private _trainControls: HTMLElement;

    constructor() {
        super();
        this.content = this._buildUi();
    }

    _buildUi(): HTMLElement {
        const container = document.createElement("div");
        const connection = Client.instance.connection;

        // Train controls
        this._trainControls = document.createElement("div");
        this._trainControls.className = "trainControls";
        container.appendChild(this._trainControls);

        // Emergency stop button
        const div = document.createElement("div");
        div.className = "emergencyStop";
        new RequestButton<CommandRequest>(div, connection, "Emergency Stop", () => {
            return {
                type: RequestType.EmergencyStop
            };
        });
        container.appendChild(div);

        return container;
    }

    onEnter(state: any) {
        Client.instance.api.getLocos().then((result: Locos) => {
            this._trainControls.innerHTML = "";
            for (const loco of result.locos) {
                new TrainControl(this._trainControls,
                    Client.instance.connection,
                    loco.name,
                    loco.address,
                    [0].concat(loco.speeds)
                );
            }
        });
    }
}

export const IndexPageConstructor: IPageConstructor = {
    path: "index",
    create: () => new IndexPage()
}