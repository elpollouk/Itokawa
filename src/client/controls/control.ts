export interface IControl {
    parent: HTMLElement;
    readonly element: HTMLElement;


    onclose: ()=>void;

    show(): void;
    hide(): void;
    close(): void;
}

export abstract class ControlBase implements IControl {
    private _parent: HTMLElement = null;
    private _element: HTMLElement;

    get parent() { return this._parent; }
    set parent(value: HTMLElement) {
        this._parent && this._parent.removeChild(this._element);
        this._parent = value;
        value && value.appendChild(this._element);
    }

    get element() { return this._element; }
    onclose: ()=>void;
    
    _init(parent?: HTMLElement) {
        this._element = this._buildUi();
        this._parent = parent;
        parent && parent.appendChild(this.element);
    }

    protected abstract _buildUi(): HTMLElement;

    show(): void {
        this._element.style.display = "";
    }

    hide(): void {
        this._element.style.display = "none";
    }

    close(): void {
        if (this._element.parentNode) {
            this.onclose && this.onclose();
            this.parent = null;
        }
    }
}