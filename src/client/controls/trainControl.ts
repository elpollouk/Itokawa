import { ControlBase } from "./control";
import { CommandConnection, ConnectionState } from "../commandConnection";
import { RequestType, LocoSpeedRequest } from "../../common/messages";
import { parseHtml, getById } from "../utils/dom";
const html = require("./trainControl.html");

export class TrainControl extends ControlBase {
    private _reverse = false;
    private _speed = 0;

    constructor (parent: HTMLElement, readonly connection: CommandConnection, readonly title: string, readonly locoId: number, readonly speeds: number[]) {
        super();
        this._init(parent);
    }

    _buildUi() {
        const control = parseHtml(html);

        getById(control, "title").innerText = this.title;

        const directionButton = getById(control, "direction");
        directionButton.onclick = () => {
            this._reverse = !this._reverse;
            directionButton.innerText = this._reverse ? "REV" : "FWD";
            this._sendRequest();
        };

        const setupButton = (id: string, speedIndex: number) => {
            const button = getById(control, id);
            button.onclick = () => {
                this._speed = this.speeds[speedIndex];
                this._sendRequest();
            };
        };

        setupButton("stop", 0);
        setupButton("slow", 1);
        setupButton("medium", 2);
        setupButton("fast", 3);

        return control;
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