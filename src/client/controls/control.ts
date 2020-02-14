export interface IControl {
    readonly parent: HTMLElement;
    readonly element: HTMLElement;

    onclose: ()=>void;

    show(): void;
    hide(): void;
    close(): void;
}

export abstract class ControlBase implements IControl {
    private _parent: HTMLElement;
    private _element: HTMLElement;

    get parent() { return this._parent; }
    get element() { return this._element; }
    onclose: ()=>void;
    
    _init( parent: HTMLElement) {
        this._element = this._buildUi();
        this._parent = parent;
        this._parent.appendChild(this.element);
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
            this._parent.removeChild(this._element);
            this._parent = null;
        }
    }
}