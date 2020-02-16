export function createElement<T extends HTMLElement>(parent: HTMLElement, tagName: string, className?: string): T {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    parent.appendChild(element);
    return element as T;
}