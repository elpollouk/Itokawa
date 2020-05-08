import { ControlBase } from "./control";
import { Navigator as nav } from "../pages/page";
import { RequestType, LocoSpeedRequest } from "../../common/messages";
import { parseHtml, getById } from "../utils/dom";
import { Loco } from "../../common/api";
import { client } from "../client";
import { LocoPanelConstructor } from "../pages/locoPanel";
const html = require("./trainControl.html");

export class TrainControl extends ControlBase {
    private _reverse = false;
    private _speed = 0;

    private _directionButton: HTMLButtonElement;
    private _speedSlider: HTMLInputElement;

    private _speedDisplay: HTMLElement;
    private readonly _maxSpeed: number;

    constructor (parent: HTMLElement, readonly loco: Loco, private readonly _expanded = false) {
        super();
        this._maxSpeed = loco.discrete ? loco.speeds[2] : loco.maxSpeed;
        this._init(parent);
    }

    _buildUi() {
        const control = parseHtml(html);

        const title = getById(control, "title");
        if (this._expanded) {
            // We don't need the title in expanded mode as we are most likely on the loco panel
            // page which has its own title for the loco
            title.parentNode.removeChild(title);
        }
        else {
            title.innerText = this.loco.name;
            title.onclick = () => this._openLocoPanel();
        }

        this._directionButton = getById(control, "direction");
        this._directionButton.onclick = () => {
            this._reverse = !this._reverse;
            this._directionButton.innerText = this._reverse ? "REV" : "FWD";
            this._updateSpeedDisplay();
            this._sendRequest();
        };

        const setupButton = (id: string, speed: number) => {
            const button = getById(control, id);
            button.onclick = () => {
                this._speed = speed;
                this._updateSpeedDisplay();
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
                this._updateSpeedDisplay();
                this._sendRequest();
            }
            this._speedSlider.oninput = () => this._updateSpeedDisplay();
        }

        const expandedControls = getById(control, "expandedControls");
        if (this._expanded) {
            this._speedDisplay = getById(control, "speedDisplay");
            getById(control, "incSpeed").onclick = () => this._incSpeed();
            getById(control, "decSpeed").onclick = () => this._decSpeed();
        }
        else {
            expandedControls.parentNode.removeChild(expandedControls);
        }

        return control;
    }

    updateSpeed(speed: number, reverse: boolean) {
        this._speed = speed;
        this._reverse = reverse;
        this._updateSpeedUi();
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
            this._updateSpeedDisplay();
        };
        sliderUpdate();
    }

    private _updateSpeedUi() {
        // We always have a direction button
        this._directionButton.innerText = this._reverse ? "REV" : "FWD";        

        // We won't have a slider if we're using discrete speeds
        const slider = this._speedSlider;
        if (!slider) {
            this._updateSpeedDisplay();
            return;
        }

        const uiSpeed = parseInt(this._speedSlider.value);
        if (uiSpeed != this._speed)
            this._animateSlider(20);
    }

    private _updateSpeedDisplay() {
        if (!this._speedDisplay) return;

        if (this._speedSlider) {
            this._speedDisplay.innerText = this._speedSlider.value;
        }
        else {
            this._speedDisplay.innerText = `${this._speed}`;
        }

        if (this._reverse) {
            this._speedDisplay.classList.remove("forward");
            this._speedDisplay.classList.add("reverse");
        }
        else {
            this._speedDisplay.classList.add("forward");
            this._speedDisplay.classList.remove("reverse");
        }
    }

    private _sendRequest() {
        client.connection.request<LocoSpeedRequest>(RequestType.LocoSpeed, {
            locoId: this.loco.address,
            speed: this._speed,
            reverse: this._reverse
        });
    }

    private _openLocoPanel() {
        nav.open(LocoPanelConstructor.path, this.loco);
        return false;
    }

    private _incSpeed() {
        if (this._speed >= this._maxSpeed) return;
        this._speed++;
        this._speedDisplay.innerText = `${this._speed}`;
        this._sendRequest();
    }

    private _decSpeed() {
        if (this._speed <= 0) return;
        this._speed--;
        this._speedDisplay.innerText = `${this._speed}`;
        this._sendRequest();
    }
}