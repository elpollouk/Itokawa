import { CommandConnection, ConnectionState } from "../commandConnection";
import { RequestType, LocoSpeedRequest } from "../../common/messages";

export class TrainControl {
    readonly element: HTMLElement;
    private _reverse = false;
    private _speed = 0;

    constructor (readonly parent: HTMLElement, readonly connection: CommandConnection, readonly title: string, readonly locoId: number, readonly speeds: number[]) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);
    }

    _buildUi() {
        const container = document.createElement("div");
        container.className = "trainControl container";

        const span = document.createElement("span");
        span.innerText = this.title;
        span.className = "title";
        container.appendChild(span);

        const directionButton = document.createElement("button");
        directionButton.innerText = "FWD";
        directionButton.onclick = () => {
            this._reverse = !this._reverse;
            directionButton.innerText = this._reverse ? "REV" : "FWD";
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

        addSpeedButton("Stop", 0);
        addSpeedButton("Low", 1);
        addSpeedButton("Medium", 2);
        addSpeedButton("Fast", 3);

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