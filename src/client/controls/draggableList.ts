import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
const elementHtml = require("./draggableListElement.html");

export type ContentCreator<T> = (data: T) => HTMLElement;
type PointerEvent = MouseEvent | TouchEvent;

interface ListItem<T> {
    element: HTMLElement,
    content: HTMLElement,
    data: T,
    mid?: number;
    height?: number;        
}

function getPageY(event: PointerEvent) {
    if (event instanceof TouchEvent) {
        return event.changedTouches[0].pageY;
    }
    return event.pageY;
}

export class DraggableList<T> extends ControlBase {

    private readonly _listItems: ListItem<T>[] = [];

    // Active drag state
    // Allowed extends of dragging
    private _minY: number;
    private _maxY: number;
    // Original Y value we started dragging from
    private _startY: number;
    // Current Y position of the midpoint of the dragged item
    private _currentMid: number = null;
    // Element being dragged
    private _draggingElement: HTMLElement = null;
    // Original top and bottom of the dragged element
    private _draggingElementTop: number;
    private _draggingElementBottom: number;

    // Event handles to capture mouse events which can be missed by the elements themselves
    private _windowOnMouseUp: (event: PointerEvent) => void;
    private _windowOnMouseMove: (event: PointerEvent) => boolean;

    get count() {
        return this._listItems.length;
    }

    constructor(parent: HTMLElement, private readonly _createContent: ContentCreator<T>) {
        super();
        this._init(parent);
        this._bindEvents();
    }

    close() {
        super.close();
        window.removeEventListener("mouseup", this._windowOnMouseUp);
        window.removeEventListener("mousemove", this._windowOnMouseMove);
    }

    addItem(data: T) {
        const content = this._createContent(data);
        const element = this._createItemElement(content);
        this._listItems.push({
            content: content,
            element: element,
            data: data
        });

        this.element.appendChild(element);
    }

    getItem(index: number): T {
        return this._listItems[index].data;
    }

    getContent(index: number): HTMLElement {
        return this._listItems[index].content;
    }

    *items(): IterableIterator<T> {
        for (const item of this._listItems)
            yield item.data;
    }

    *content(): IterableIterator<HTMLElement> {
        for (const item of this._listItems)
            yield item.content;
    }

    protected _buildUi(): HTMLElement {
        const element = document.createElement("div");
        element.className = "draggableList";
        return element;
    }

    private _onPointerDown(element: HTMLElement, event: PointerEvent) {
        element.classList.add("dragging");
        this._startY = getPageY(event);
        this._currentMid = null;
    
        // Fetch and cache the current list item positions and sizes
        for (const item of this._listItems) {
            const rect = item.element.getBoundingClientRect();
            if (item.element === element) {
                // Cache the top and the bottom for the element being dragged as we need to determine
                // when we go beyond the midpoint of other elements in the list
                this._draggingElementTop = rect.top;
                this._draggingElementBottom = rect.bottom;
            }
            else {
                item.element.classList.add("shiftable");
            }
            // The midpoint is used to calculate if we've dragged the item above or below this item
            item.mid = (rect.top + rect.bottom) / 2;
            // The height is used to update the top value after shifting
            item.height = rect.bottom - rect.top;
        }
    
        // Calculate new list extents to put a limit on dragging
        const rect = this.element.getBoundingClientRect();
        this._minY = rect.top - 10;
        this._maxY = rect.bottom + 10;
    
        // Record this element as being dragged
        this._draggingElement = element;
    
        return false;
    }

    private _onPointerMove(element: HTMLElement, event: PointerEvent) {
        if (!this._draggingElement || this._draggingElement != element) return;

        // Calculate the current drag offset
        let dY = getPageY(event) - this._startY;
    
        // Clamp dragging within the bounds of the list
        if ((this._draggingElementTop + dY) < this._minY) dY = this._minY - this._draggingElementTop;
        else if ((this._draggingElementBottom + dY) > this._maxY) dY = this._maxY - this._draggingElementBottom;
    
        element.style.transform = `translateY(${dY}px)`;
    
        // Are we processing elements originally above the element being dragged?
        let above = true;
        const currentTop = this._draggingElementTop + dY;
        const currentBottom = this._draggingElementBottom + dY;
        this._currentMid = (currentTop + currentBottom) / 2;
        for (const item of this._listItems) {
            if (item.element === element) {
                // We've hit the element being dragged, so everything else in the list was originally
                // below it
                above = false;
            }
            else if (above && currentTop < item.mid) {
                // If this item was originally above the element being dragged, shift it down
                item.element.classList.add("shiftDown");
            }
            else if (!above && currentBottom > item.mid) {
                // If it was below it, shift it up
                item.element.classList.add("shiftUp");
            }
            else {
                // Item is still currently in the correct sort order so no shifting required
                item.element.classList.remove("shiftUp");
                item.element.classList.remove("shiftDown");
            }
        }
    
        return false;
    }

    private _onPointerUp(element: HTMLElement, event: PointerEvent) {
        if (!this._draggingElement || this._draggingElement != element) return;

        element.classList.remove("dragging");
        element.style.transform = "";
    
        // First pass over the list to update the top values to ensure the correct sort order, removing
        // utility classes as we go
        for (const item of this._listItems) {
            if (item.element === element) {
                item.mid = this._currentMid;
            }
            else if (item.element.classList.contains("shiftUp")) {
                item.element.classList.remove("shiftUp");
                item.mid -= item.height;
            }
            else if (item.element.classList.contains("shiftDown")) {
                item.element.classList.remove("shiftDown");
                item.mid += item.height;
            }
            item.element.classList.remove("shiftable");
        }
    
        // If we actually dragged the element, sort the list based on each elements mid value
        if (this._currentMid !== null) {
            this._listItems.sort((a, b) => a.mid - b.mid);
            // Clear out the elements from the UI and re-add them in their new order
            this.element.innerHTML = "";
            for (const item of this._listItems) {
                this.element.appendChild(item.element);
            }
        }
    
        this._draggingElement = null;
        return false;
    }

    private _createItemElement(content: HTMLElement) {
        const element = parseHtml(elementHtml);
        getById(element, "dragContent").appendChild(content);

        // We want to handle both mouse and touch events, so bind them all
        const dragHandle = getById(element, "dragHandle");
        dragHandle.onmousedown = (event) => this._onPointerDown(element, event);
        dragHandle.onmousemove = (event) => this._onPointerMove(element, event);
        dragHandle.onmouseup = (event) => this._onPointerUp(element, event);
        dragHandle.ontouchstart = (event) => this._onPointerDown(element, event);
        dragHandle.ontouchmove = (event) => this._onPointerMove(element, event);
        dragHandle.ontouchend = (event) => this._onPointerUp(element, event);

        return element;
    }

    private _bindEvents() {
        // We need to hook into the window events as the mouse can escape the bounds of the dragged element
        this._windowOnMouseUp = (event: PointerEvent) => this._onPointerUp(this._draggingElement, event);
        window.addEventListener("mouseup", this._windowOnMouseUp);
        this._windowOnMouseMove = (event: PointerEvent) => this._onPointerMove(this._draggingElement, event);
        window.addEventListener("mousemove", this._windowOnMouseMove);
    }
}