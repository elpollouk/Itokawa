import { ControlBase, IControl } from "./control";
import * as popup from "./popup";

export interface PromptButton {
    caption: string;
    onclick?: ()=>void;
}

class PromptControl extends ControlBase {
    constructor(private message: string,
                private buttons: PromptButton[],
                onclose?:()=>void) {
        super();
        this._init();
        this.onclose = onclose;
    }

    protected _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "prompt";

        const message = document.createElement("div");
        message.className = "message";
        message.innerText = this.message;
        container.appendChild(message);

        const buttons = document.createElement("div");
        buttons.className = "buttons";
        container.appendChild(buttons);

        const createButton = (config: PromptButton) => {
            const button = document.createElement("button");
            button.innerText = config.caption;
            button.onclick = (ev) => {
                config.onclick && config.onclick();

                // Clear out the close handler so that it doesn't fire as a result of us directly closing
                // the prompt
                this.onclose = null;
                this.close();
                popup.remove(this);

                // We need to stop propagation so that the click doesn't make its way back to the protection
                // level cancelling any newly created popups
                ev.stopImmediatePropagation();
            }
            buttons.appendChild(button);
        }

        for (const button of this.buttons)
            createButton(button);

        return container;
    }
    
    hide() {
        this.close();
    }
}

export function prompt(message: string, buttons: PromptButton[], onclose?:()=>void): PromptControl {
    var prompt = new PromptControl(message, buttons, () => {
        onclose && onclose();
        popup.remove(prompt);
    });
    popup.add(prompt);

    return prompt;
}

export function stackedPrompt(message: string, buttons: PromptButton[], onclose?:()=>void): PromptControl {
    var prompt = new PromptControl(message, buttons, () => {
        onclose && onclose();
        popup.remove(prompt);
    });
    popup.add(prompt);
    prompt.element.classList.add("stacked");
    return prompt;
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

export function message(message: string): PromptControl {
    return prompt(message, [{
        caption: "OK"
    }]);
}

export function error(message: string): PromptControl {
    const p = prompt(message, [{
        caption: "OK"
    }]);
    p.element.classList.add("error");
    return p;
}