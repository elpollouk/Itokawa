import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
const html = require("./cvControl.html");

const enum State {
    clean = 0,
    dirty = 1,
    updating = 2
}

const _stateClasses = [
    "clean",
    "dirty",
    "updating"
]

export class CvControl extends ControlBase {
    private _valueElement: HTMLInputElement;
    private _state: State = State.clean;

    get cv() {
        return this._cv;
    }

    get value() {
        return this._value;
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
        return this._valueElement.value !== `${this._value}`;
    }

    set value(v: number) {
        if (v < 0 || v > 255) throw new Error("Invalid CV value");
        this._value = v;
        this._valueElement.value = `${v}`;
        this.state = State.clean;
    }

    constructor (parent: HTMLElement, private _cv: number, private _value: number) {
        super();
        if (_value < 0 || _value > 255) throw new Error("Invalid CV value");
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);

        getById(control, "cv").innerText = `${this._cv}`;
        this._valueElement = getById<HTMLInputElement>(control, "value");
        this._valueElement.value = `${this._value}`;
        this._valueElement.onchange = () => this._onValueChanged();
        this._valueElement.oninput = () => this._onValueChanged();

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