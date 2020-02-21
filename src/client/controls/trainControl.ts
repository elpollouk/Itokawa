import { ControlBase } from "./control";
import { ConnectionState } from "../commandConnection";
import { RequestType, LocoSpeedRequest } from "../../common/messages";
import { parseHtml, getById } from "../utils/dom";
import { Loco } from "../../common/api";
import { Client } from "../client";
const html = require("./trainControl.html");

export class TrainControl extends ControlBase {
    private _reverse = false;
    private _speed = 0;

    private _directionButton: HTMLButtonElement;
    private _speedSlider: HTMLInputElement;

    constructor (parent: HTMLElement, readonly loco: Loco) {
        super();
        this._init(parent);
    }

    _buildUi() {
        const control = parseHtml(html);

        getById(control, "title").innerText = this.loco.name;

        this._directionButton = getById(control, "direction");
        this._directionButton.onclick = () => {
            this._reverse = !this._reverse;
            this._directionButton.innerText = this._reverse ? "REV" : "FWD";
            this._sendRequest();
        };

        const setupButton = (id: string, speed: number) => {
            const button = getById(control, id);
            button.onclick = () => {
                this._speed = speed;
                this._sendRequest();
            };
        };

        setupButton("stop", 0);
        if (this.loco.discrete) {
            control.classList.add("discrete");
            setupButton("slow", this.loco.speeds[0]);
            setupButton("medium", this.loco.speeds[1]);
            setupButton("fast", this.loco.speeds[2]);
        }
        else {
            this._speedSlider = getById<HTMLInputElement>(control, "speed");
            this._speedSlider.max = `${this.loco.maxSpeed}`;
            this._speedSlider.onchange = () => {
                this._speed = parseInt(this._speedSlider.value);
                this._sendRequest();
            }
        }

        return control;
    }

    updateSpeed(speed: number, reverse: boolean) {
        this._speed = speed;
        this._reverse = reverse;
        this._updateSpeed();
    }

    private _updateSpeed() {
        const slider = this._speedSlider;
        if (!slider) return;

        const uiSpeed = parseInt(this._speedSlider.value);
        if (uiSpeed != this._speed)
            this._speedSlider.value = `${this._speed}`;

        this._directionButton.innerText = this._reverse ? "REV" : "FWD";        
    }

    private _sendRequest() {
        if (Client.instance.connection.state !== ConnectionState.Idle) return;
        this._updateSpeed();
        const request: LocoSpeedRequest = {
            locoId: this.loco.address,
            speed: this._speed,
            reverse: this._reverse
        };
        Client.instance.connection.request(RequestType.LocoSpeed, request);
    }
}