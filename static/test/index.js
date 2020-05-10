"use strict";

let minY;
let maxY;

let listElement;
let listItems = [];

// Current drag state
let startY;
let currentTop = null;
let draggingElement = null;
let draggingElementTop;
let draggingElementBottom;

function getPageY(evnt) {
    if (evnt.changedTouches) {
        return evnt.changedTouches[0].pageY;
    }
    return evnt.pageY;
}

function onPointerDown(element, evnt) {
    element.classList.add("dragging");
    startY = getPageY(evnt);
    currentTop = null;

    // Fetch and cache the current list item positions and sizes
    for (const item of listItems) {
        const rect = item.element.getBoundingClientRect();
        if (item.element === element) {
            // Cache the top and the bottom for the element being dragged as we need to determine
            // when we go beyond the midpoint of other elements in the list
            draggingElementTop = rect.top;
            draggingElementBottom = rect.bottom;
        }
        else {
            item.element.classList.add("shiftable");
        }
        // We use the top for the final sorting order
        item.top = rect.top;
        // The midpoint is used to calculate if we've dragged the item above or below this item
        item.mid = (rect.top + rect.bottom) / 2;
        // The height is used to update the top value after shifting
        item.height = rect.bottom - rect.top;
    }

    // Calculate new list extents to put a limit on dragging
    const rect = listElement.getBoundingClientRect();
    minY = rect.top - 10;
    maxY = rect.bottom + 10;

    // Record this element as being dragged
    draggingElement = element;

    return false;
}

function onPointerUp(element, evnt) {
    if (!draggingElement || draggingElement != element) return;

    element.classList.remove("dragging");
    element.style.transform = "";

    // First pass over the list to update the top values to ensure the correct sort order, removing
    // utility classes as we go
    for (const item of listItems) {
        if (item.element === element) {
            item.top = currentTop;
        }
        else if (item.element.classList.contains("shiftUp")) {
            item.element.classList.remove("shiftUp");
            item.top -= item.height;
        }
        else if (item.element.classList.contains("shiftDown")) {
            item.element.classList.remove("shiftDown");
            item.top += item.height;
        }
        item.element.classList.remove("shiftable");
    }

    // If we actually dragged the element, sort the list based on each elements top value
    if (currentTop !== null) {
        listItems.sort((a, b) => a.top - b.top);
        // Clear out the elements from the UI and re-add them in their new order
        listElement.innerHTML = "";
        for (const item of listItems) {
            listElement.appendChild(item.element);
        }
    }

    draggingElement = null;
    return false;
}

function onPointerMove(element, evnt) {
    if (!draggingElement || draggingElement != element) return;

    // Calculate the current drag offset
    let dY = getPageY(evnt) - startY;

    // Clamp dragging within the bounds of the list
    if ((draggingElementTop + dY) < minY) dY = minY - draggingElementTop;
    else if ((draggingElementBottom + dY) > maxY) dY = maxY - draggingElementBottom;

    element.style.transform = `translateY(${dY}px)`;

    // Are we processing elements originally above the element being dragged?
    let above = true;
    currentTop = draggingElementTop + dY;
    let currentBottom = draggingElementBottom + dY;
    for (const item of listItems) {
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

function addItem(parent, text) {
    const item = document.createElement("div");
    const span = document.createElement("span");
    const handle = document.createElement("div");
    item.className = "dragItem";
    item.appendChild(span);
    item.appendChild(handle);
    span.innerText = text;
    handle.className = "dragHandle";

    // We want to handle both mouse and touch events, so bind them all
    handle.onmousedown = (evnt) => onPointerDown(item, evnt);
    handle.onmousemove = (evnt) => onPointerMove(item, evnt);
    handle.onmouseup = (evnt) => onPointerUp(item, evnt);
    handle.ontouchstart = (evnt) => onPointerDown(item, evnt);
    handle.ontouchmove = (evnt) => onPointerMove(item, evnt);
    handle.ontouchend = (evnt) => onPointerUp(item, evnt);

    parent.appendChild(item);

    listItems.push({
        element: item,
        top: null,
        mid: null,
        height: null
    });
}

function main() {
    console.log("Hello World");

    listElement = document.getElementById("list");
    addItem(listElement, "A");
    addItem(listElement, "B");
    addItem(listElement, "C");
    addItem(listElement, "D");
    addItem(listElement, "E");
    addItem(listElement, "F");
    addItem(listElement, "G");
    addItem(listElement, "H");
    addItem(listElement, "I");

    // We need to hook into the window events as the mouse can escape the bounds of the dragged element
    window.addEventListener("mouseup", (evnt) => onPointerUp(draggingElement, evnt));
    window.addEventListener("mousemove", (evnt) => onPointerMove(draggingElement, evnt));
}