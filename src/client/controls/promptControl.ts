import * as protection from "./protectionControl";

export interface PromptButton {
    caption: string;
    onclick?: ()=>void;
}

class PromptControl {
    readonly element: HTMLElement;

    constructor(readonly parent: HTMLElement,
                readonly message: string,
                readonly buttons: PromptButton[],
                readonly onclose?:()=>void) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);
    }

    _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "prompt";

        const message = document.createElement("div");
        message.className = "message";
        message.innerText = this.message;
        container.appendChild(message);

        const buttons = document.createElement("div");
        buttons.className = "buttons";
        container.appendChild(buttons);

        function createButton(config: PromptButton) {
            const button = document.createElement("button");
            button.innerText = config.caption;
            if (config.onclick) button.onclick = () => {
                config.onclick();
            }
            buttons.appendChild(button);
        }

        for (const button of this.buttons)
            createButton(button);

        return container;
    }

    show() {
        this.element.style.display = "";
    }

    hide() {
        this.element.style.display = "none";
    }

    close() {
        if (this.element.parentNode) {
            this.onclose && this.onclose();
            this.parent.removeChild(this.element);
            _removePrompt(this);
        }
    }
}

let _prompts: PromptControl[] = [];

export function prompt(message: string, buttons: PromptButton[], onclose?:()=>void): PromptControl {
    const container = document.getElementById("popupContainer");

    if (_prompts.length !== 0) {
        // If there is already a popup visible, hide the top most
        _prompts[_prompts.length-1].hide();
    }
    else {
        // If this is the first popup, then we  need to set up protections
        protection.enableProtection();
        container.classList.add("active");
        container.onclick = () => {
            const prompt = _prompts[_prompts.length-1];
            prompt.close();
        };
    }

    var prompt = new PromptControl(container, message, buttons, onclose);
    _prompts.push(prompt);

    return prompt;
}

function _removePrompt(prompt: PromptControl) {
    const container = document.getElementById("popupContainer");

    for (let i = 0; i < _prompts.length; i++) {
        if (_prompts[i] == prompt) {
            _prompts.splice(i, 1);
            break;
        }
    }

    if (_prompts.length === 0) {
        protection.disableProtection();
        container.classList.remove("active");
    }
    else {
        _prompts[_prompts.length-1].show();
    }
}

export function confirm(message: string, onYes:()=>void, onNo?:()=>void): PromptControl {
    return prompt(message, [{
        caption: "Yes",
        onclick: onYes
    }, {
        caption: "No",
        onclick: onNo
    }], onNo);
}