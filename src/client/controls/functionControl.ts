import { ControlBase } from "./control";
import { FunctionConfig, FunctionMode } from "../../common/api";
import { client } from "../client";
import { FunctionAction, LocoFunctionRequest, RequestType } from "../../common/messages";

const LATCHED_CLASS = "latchedOn";

export class FunctionControl extends ControlBase {
    private _latchedOn: boolean;

    constructor(parent: HTMLElement, private readonly _locoId: number, private readonly _function: FunctionConfig) {
        super();
        this._latchedOn = false;
        this._init(parent);
    }

    get latchedOn() {
        return this._latchedOn;
    }

    set latchedOn(value: boolean) {
        this._latchedOn = value;
        if (value) {
            this._element.classList.add(LATCHED_CLASS);
        }
        else {
            this._element.classList.remove(LATCHED_CLASS);
        }
    }

    protected _buildUi(): HTMLElement {
        const button = document.createElement("button");
        button.classList.add("function");
        if (this._latchedOn) button.classList.add(LATCHED_CLASS);
        button.innerText = this._function.name;
        button.onclick = () => this._onExecute();
        return button;
    }

    private _toggleLatchedStatus() {
        if (this._function.mode !== FunctionMode.Latched) return;
        this._latchedOn = !this._latchedOn;
        return this._latchedOn;
    }

    private _onExecute() {
        if (this._function.mode === FunctionMode.Latched) {
            this.latchedOn = this._toggleLatchedStatus();
            if (this.latchedOn) {
                this._sendRequest(FunctionAction.LatchOn);
            }
            else {
                this._sendRequest(FunctionAction.LatchOff);
            }
        }
        else {
            this._sendRequest(FunctionAction.Trigger);
        }
    }

    private _sendRequest(action: FunctionAction) {
        client.connection.request<LocoFunctionRequest>(RequestType.LocoFunction, {
            locoId: this._locoId,
            function: parseInt(this._function.exec),
            action: action
        });
    }
}