export function createElement(parent: HTMLElement, tagName: string, className?: string): HTMLElement {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
}