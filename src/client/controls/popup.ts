import { IControl } from "./control";
import * as protection from "./protectionControl";

let _popups: IControl[] = [];

function popupContainer() {
    return document.getElementById("popupContainer");
}

export function add(popup: IControl) {
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

export function remove(popup: IControl) {
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
