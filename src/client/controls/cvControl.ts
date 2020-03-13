import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
const html = require("./cvControl.html");

export enum State {
    clean = 0,
    dirty = 1,
    updating = 2
}

const _stateClasses = [
    "clean",
    "dirty",
    "updating"
]

const _readOnlyCVs = new Set([
   7, 8 
]);

export class CvControl extends ControlBase {
    private _valueElement: HTMLInputElement;
    private _state: State = State.clean;

    get cv() {
        return this._cv;
    }

    get value() {
        return parseInt(this._valueElement.value);
    }

    get state() {
        return this._state;
    }

    set state(value: State) {
        this._state = value;
        const desiredClass = _stateClasses[value];
        for (const cls of _stateClasses) {
            if (desiredClass === cls) {
                this.element.classList.add(cls);
            }
            else {
                this.element.classList.remove(cls);
            }
        }
    }

    get isDirty() {
        return this._valueElement.value !== `${this._originalValue}`;
    }

    set value(v: number) {
        if (v < 0 || v > 255) throw new Error("Invalid CV value");
        this._originalValue = v;
        this._valueElement.value = `${v}`;
        this.state = State.clean;
    }

    constructor (parent: HTMLElement, private _cv: number, private _originalValue: number) {
        super();
        if (_originalValue < 0 || _originalValue > 255) throw new Error("Invalid CV value");
        this._init(parent);
        this.state = State.clean;
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);

        getById(control, "cv").innerText = `${this._cv}`;
        this._valueElement = getById<HTMLInputElement>(control, "value");
        this._valueElement.value = `${this._originalValue}`;
        this._valueElement.onchange = () => this._onValueChanged();
        this._valueElement.oninput = () => this._onValueChanged();
        this._valueElement.readOnly = _readOnlyCVs.has(this._cv);

        return control
    }

    private _onValueChanged() {
        if (this.isDirty) {
            this.state = State.dirty;
        }
        else {
            this.state = State.clean;
        }
    }
}