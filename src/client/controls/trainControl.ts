import { ControlBase } from "./control";
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

    private _animateSlider(frames: number) {
        // Calculate the animation speed required to arrive at the target speed in the requested number of frames
        const requestedSpeed = this._speed;
        let currentSpeed = parseInt(this._speedSlider.value);
        const step = (requestedSpeed - currentSpeed) / frames;

        const sliderUpdate = () => {
            if (this._speed != requestedSpeed) return; // Give up if there has been another speed change

            currentSpeed += step;
            if (Math.abs(this._speed - currentSpeed) < 1.0) {
                // Close enough, just set the speed
                this._speedSlider.value = `${this._speed}`;
            }
            else {
                this._speedSlider.value = `${currentSpeed}`;
                frames--;
                if (frames !== 0)
                    requestAnimationFrame(sliderUpdate);
            }
        };
        sliderUpdate();
    }

    private _updateSpeed() {
        // We always have a direction button
        this._directionButton.innerText = this._reverse ? "REV" : "FWD";        

        // We won't have a slider if we're using discrete speeds
        const slider = this._speedSlider;
        if (!slider) return;

        const uiSpeed = parseInt(this._speedSlider.value);
        if (uiSpeed != this._speed)
            this._animateSlider(20);
    }

    private _sendRequest() {
        Client.instance.connection.request<LocoSpeedRequest>(RequestType.LocoSpeed, {
            locoId: this.loco.address,
            speed: this._speed,
            reverse: this._reverse
        });
    }
}