import * as prompt from "../controls/promptControl";

export function createElement<T extends HTMLElement>(parent: HTMLElement, tagName: string, className?: string): T {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    parent.appendChild(element);
    return element as T;
}

export function parseHtml(content: string): HTMLElement {
    const parser = document.createElement("div");
    parser.innerHTML = content;
    return parser.children.item(0) as HTMLElement;
}

export function getById<T extends HTMLElement>(element: HTMLElement, id: string): T {
    return element.querySelector(`[data-id="${id}"]`);
}

export function vaildateNotEmptyInput(input: HTMLInputElement, message: string) {
    let value = input.value;
    if (!value) {
        prompt.error(message).then(() => input.focus());
        return false;
    }
    return true;
}

export function vaildateIntInput(input: HTMLInputElement, message: string) {
    let value = parseInt(input.value);
    const min = input.min ? parseInt(input.min) : Number.MIN_VALUE;
    const max = input.max ? parseInt(input.max) : Number.MAX_VALUE;

    if (isNaN(value) || value < min || value > max) {
        console.log("not valid");
        prompt.error(message).then(() => input.focus());
        return false;
    }
    console.log("valid");
    return true;
}