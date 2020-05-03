import { ControlBase } from "./control";
import { FunctionConfig, FunctionMode } from "../../common/api";
import { client } from "../client";
import { FunctionAction, LocoFunctionRequest, RequestType } from "../../common/messages";

const LATCHED_CLASS = "latchedOn";

const _latchStatus = new Map<number, Map<string, boolean>>();

export class FunctionControl extends ControlBase {
    private _latchedOn: boolean;

    constructor(parent: HTMLElement, private readonly _locoId: number, private readonly _function: FunctionConfig) {
        super();
        this._latchedOn = this._getLatchedStatus();
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const button = document.createElement("button");
        button.classList.add("function");
        if (this._latchedOn) button.classList.add(LATCHED_CLASS);
        button.innerText = this._function.name;
        button.onclick = () => this._onExecute();
        return button;
    }

    private _getLatchedStatus() {
        if (this._function.mode !== FunctionMode.Latched) return false;
        const locoStatus = _latchStatus.get(this._locoId);
        if (!locoStatus) return false;
        return !!locoStatus.get(this._function.exec);
    }

    private _toggleLatchedStatus() {
        if (this._function.mode !== FunctionMode.Latched) return;
        this._latchedOn = !this._latchedOn;
        let locoStatus = _latchStatus.get(this._locoId);
        if (!locoStatus) {
            locoStatus = new Map<string, boolean>();
            _latchStatus.set(this._locoId, locoStatus);
        }
        locoStatus.set(this._function.exec, this._latchedOn);
        return this._latchedOn;
    }

    private _onExecute() {
        if (this._function.mode === FunctionMode.Latched) {
            if (this._toggleLatchedStatus()) {
                this._element.classList.add(LATCHED_CLASS);
                this._sendRequest(FunctionAction.LatchOn);
            }
            else {
                this._element.classList.remove(LATCHED_CLASS);
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