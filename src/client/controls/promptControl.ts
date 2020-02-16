import { ControlBase, IControl } from "./control";
import * as protection from "./protectionControl";

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

let _popups: IControl[] = [];

function popupContainer() {
    return document.getElementById("popupContainer");
}

export function addPopop(popup: IControl) {
    const container = popupContainer();

    if (_popups.length !== 0) {
        // If there is already a popup visible, hide the top most
        _popups[_popups.length-1].hide();
    }

    // We need to different checks as calling a control's .hide() method could modify the popups list
    if (_popups.length === 0) {
        // If this is the first popup, then we  need to set up protections
        protection.enableProtection();
        container.classList.add("active");
        container.onclick = () => {
            const control = _popups[_popups.length-1];
            control.close();
        };
    }

    popup.parent = container;
    _popups.push(popup);
}

export function removePopup(popup: IControl) {
    for (let i = 0; i < _popups.length; i++) {
        if (_popups[i] == popup) {
            popup.parent = null;
            _popups.splice(i, 1);
            break;
        }
    }

    if (_popups.length === 0) {
        protection.disableProtection();
        popupContainer().classList.remove("active");
    }
    else {
        _popups[_popups.length-1].show();
    }
}

export function prompt(message: string, buttons: PromptButton[], onclose?:()=>void): PromptControl {
    var prompt = new PromptControl(message, buttons, () => {
        onclose && onclose();
        removePopup(prompt);
    });
    addPopop(prompt);

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