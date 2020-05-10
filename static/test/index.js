"use strict";

let minY;
let maxY;

let listElements = [];

// Current drag state
let startY;
let draggingElement = null;
let draggingElementTop;
let draggingElementBottom;

function onPointerDown(element, evnt) {
    element.classList.add("dragging");
    if (evnt.changedTouches) {
        startY = evnt.changedTouches[0].clientY;
    }
    else {
        startY = evnt.pageY;
    }

    for (const item of listElements) {
        const rect = item.element.getBoundingClientRect();
        if (item.element === element) {
            draggingElementTop = rect.top;
            draggingElementBottom = rect.bottom;
        }
        else {
            item.element.classList.add("shiftable");
        }
        item.top = rect.top;
        item.bottom = rect.bottom;
    }

    // Calculate new list extents
    const rect = element.parentElement.getBoundingClientRect();
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
    for (const item of listElements) {
        item.element.classList.remove("shiftUp");
        item.element.classList.remove("shiftDown");
        item.element.classList.remove("shiftable");
    }

    draggingElement = null;
    return false;
}

function onPointerMove(element, evnt) {
    if (!draggingElement || draggingElement != element) return;

    let pageY;
    if (evnt.changedTouches) {
        pageY = evnt.changedTouches[0].pageY;
    }
    else {
        pageY = evnt.pageY;
    }

    let dY = pageY - startY;

    if ((draggingElementTop + dY) < minY) dY = minY - draggingElementTop;
    else if ((draggingElementBottom + dY) > maxY) dY = maxY - draggingElementBottom;

    element.style.transform = `translateY(${dY}px)`;

    let above = true;
    let currentTop = draggingElementTop + dY;
    let currentBottom = draggingElementBottom + dY;
    for (const item of listElements) {
        if (item.element === element) {
            above = false;
        }
        else if (above && currentTop < item.top) {
            item.element.classList.add("shiftDown");
        }
        else if (!above && currentBottom > item.bottom) {
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

    listElements.push({
        element: item,
        top: -1,
        bottom: -1
    });
}

function main() {
    console.log("Hello World");

    const list = document.getElementById("list");
    addItem(list, "A");
    addItem(list, "B");
    addItem(list, "C");
    addItem(list, "D");
    addItem(list, "E");
    addItem(list, "F");
    addItem(list, "G");
    addItem(list, "H");
    addItem(list, "I");

    window.onmouseup = (evnt) => onPointerUp(draggingElement, evnt);
    window.onmousemove = (evnt) => onPointerMove(draggingElement, evnt);
}