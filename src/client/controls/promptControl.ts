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
    
    hide() {
        this.close();
    }

    close() {
        this.onclose && this.onclose();
        super.close();
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

export function confirm(message: string, onYes:()=>void, onNo?:()=>void): PromptControl {
    return prompt(message, [{
        caption: "Yes",
        onclick: onYes
    }, {
        caption: "No",
        onclick: onNo
    }], onNo);
}