"use strict";

let minY;
let maxY;

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
    draggingElement = element;
    const rect = draggingElement.getBoundingClientRect();
    draggingElementTop = rect.top;
    draggingElementBottom = rect.bottom;

    evnt.stopImmediatePropagation();
    return false;
}

function onPointerUp(element, evnt) {
    if (!draggingElement || draggingElement != element) return;

    element.classList.remove("dragging");
    element.style.transform = "";
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

    const rect = parent.getBoundingClientRect();
    console.log(`top=${rect.top}, bottom=${rect.bottom}`);
    minY = rect.top - 10;
    maxY = rect.bottom + 10;
}

function main() {
    console.log("Hello World");

    const list = document.getElementById("list");
    addItem(list, "A");
    addItem(list, "B");
    addItem(list, "C");
    addItem(list, "D"); 

    window.onmouseup = (evnt) => onPointerUp(draggingElement, evnt);
    window.onmousemove = (evnt) => onPointerMove(draggingElement, evnt);
}