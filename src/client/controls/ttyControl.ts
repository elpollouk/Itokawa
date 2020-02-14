import { ControlBase } from "./control";

function htmlEscape(text: string): string {
    return text
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        /*.replace(/ /g, "&nbsp;")*/
        .replace(/\r\n/g, "<br/>")
        .replace(/\n/g, "<br/>")
        .replace(/\r/g, "<br/>");
}

export class TtyControl extends ControlBase {

    constructor(parent: HTMLElement) {
        super();
        this._init(parent);
    }

    _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "tty";
        return container;
    }

    _write(text: string, className?: string) {
        const span = document.createElement("span");
        if (className) span.className = className;
        span.innerHTML = htmlEscape(text);
        this.element.appendChild(span);
        span.scrollIntoView();
    }

    stdout(text: string) {
        this._write(text);
    }

    stderr(text: string) {
        this._write(text, "stderr");
    }
}