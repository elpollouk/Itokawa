import { Client } from "../client";
import { Page, IPageConstructor } from "./page";
import { TrainControl } from "../controls/trainControl";
import { RequestButton } from "../controls/requestButton";
import { CommandRequest, RequestType } from "../../common/messages";

class IndexPage extends Page {
    path: string = IndexPageConstructor.path;    
    content: HTMLElement;

    constructor() {
        super();
        this.content = this._buildUi();
    }

    _buildUi(): HTMLElement {
        const container = document.createElement("div");
        const connection = Client.instance.connection;

        // Train controls
        let div = document.createElement("div");
        div.className = "trainControls";
        new TrainControl(div,
            connection,
            "Class 43 HST",
            4305, [0, 32, 64, 96]);
        new TrainControl(div,
            connection,
            "GWR 0-6-0",
            2732, [0, 32, 48, 64]);
        new TrainControl(div,
            connection,
            "LMS 2-6-4",
            2328, [0, 32, 56, 80]);

        container.appendChild(div);

        // Emergency stop button
        div = document.createElement("div");
        div.className = "emergencyStop";
        new RequestButton<CommandRequest>(div, connection, "Emergency Stop", () => {
            return {
                type: RequestType.EmergencyStop
            };
        });
        container.appendChild(div);

        return container;
    }
}

export const IndexPageConstructor: IPageConstructor = {
    path: "index",
    create: () => new IndexPage()
}