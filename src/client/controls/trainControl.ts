import { ControlBase } from "./control";
import { CommandConnection, ConnectionState } from "../commandConnection";
import { RequestType, LocoSpeedRequest } from "../../common/messages";

export class TrainControl extends ControlBase {
    private _reverse = false;
    private _speed = 0;

    constructor (parent: HTMLElement, readonly connection: CommandConnection, readonly title: string, readonly locoId: number, readonly speeds: number[]) {
        super();
        this._init(parent);
    }

    _buildUi() {
        const container = document.createElement("div");
        container.className = "trainControl container";

        const span = document.createElement("span");
        span.innerText = this.title;
        span.className = "title";
        container.appendChild(span);

        const directionButton = document.createElement("button");
        directionButton.innerText = "F";
        directionButton.onclick = () => {
            this._reverse = !this._reverse;
            directionButton.innerText = this._reverse ? "R" : "F";
            this._sendRequest();
        };
        container.appendChild(directionButton);

        const addSpeedButton = (title: string, speedIndex: number) => {
            const button = document.createElement("button");
            button.innerText = title;
            button.onclick = () => {
                this._speed = this.speeds[speedIndex];
                this._sendRequest();
            };

            container.appendChild(button);
        };

        addSpeedButton("0", 0);
        addSpeedButton("1", 1);
        addSpeedButton("2", 2);
        addSpeedButton("3", 3);

        return container;
    }

    private _sendRequest() {
        if (this.connection.state !== ConnectionState.Idle) return;
        const request: LocoSpeedRequest = {
            type: RequestType.LocoSpeed,
            locoId: this.locoId,
            speed: this._speed,
            reverse: this._reverse
        };
        this.connection.request(request);
    }
}