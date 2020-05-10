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

    for (const item of listItems) {
        const rect = item.element.getBoundingClientRect();
        if (item.element === element) {
            draggingElementTop = rect.top;
            draggingElementBottom = rect.bottom;
        }
        else {
            item.element.classList.add("shiftable");
        }
        item.top = rect.top;
        item.mid = (rect.top + rect.bottom) / 2;
        item.height = rect.bottom - rect.top;
    }

    // Calculate new list extents
    const rect = listElement.getBoundingClientRect();
    console.log(`top=${rect.top}, bottom=${rect.bottom}`);
    minY = rect.top - 10;
    maxY = rect.bottom + 10;

    draggingElement = element;

    evnt.stopImmediatePropagation();
    return false;
}

function onPointerUp(element, evnt) {
    if (!draggingElement || draggingElement != element) return;

    element.classList.remove("dragging");
    element.style.transform = "";

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

    if (currentTop !== null) {
        listItems.sort((a, b) => a.top - b.top);
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

    let dY = getPageY(evnt) - startY;

    if ((draggingElementTop + dY) < minY) dY = minY - draggingElementTop;
    else if ((draggingElementBottom + dY) > maxY) dY = maxY - draggingElementBottom;

    element.style.transform = `translateY(${dY}px)`;

    let above = true;
    currentTop = draggingElementTop + dY;
    let currentBottom = draggingElementBottom + dY;
    for (const item of listItems) {
        if (item.element === element) {
            above = false;
        }
        else if (above && currentTop < item.mid) {
            item.element.classList.add("shiftDown");
        }
        else if (!above && currentBottom > item.mid) {
            item.element.classList.add("shiftUp");
        }
        else {
            item.element.classList.remove("shiftUp");
            item.element.classList.remove("shiftDown");
        }
    }

    evnt.stopImmediatePropagation();
    return false;
}

function addItem(parent, text) {
    const item = document.createElement("div");
    item.className = "dragItem";
    item.innerText = text;

    item.onmousedown = (evnt) => onPointerDown(item, evnt);
    item.onmousemove = (evnt) => onPointerMove(item, evnt);
    item.onmouseup = (evnt) => onPointerUp(item, evnt);
    item.ontouchstart = (evnt) => onPointerDown(item, evnt);
    item.ontouchmove = (evnt) => onPointerMove(item, evnt);
    item.ontouchend = (evnt) => onPointerUp(item, evnt);

    parent.appendChild(item);

    listItems.push({
        element: item,
        top: null,
        mid: null
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

    window.onmouseup = (evnt) => onPointerUp(draggingElement, evnt);
    window.onmousemove = (evnt) => onPointerMove(draggingElement, evnt);
}