let _protectionCount = 0;

export function enableProtection(onclick?: ()=>void) {
    _protectionCount++;

    if (_protectionCount === 1) {
        const element = document.getElementById("protection");
        element.classList.add("active");
        element.onclick = onclick;
    }
}

export function disableProtection() {
    if (_protectionCount === 0) throw new Error("Protection is not active");
    _protectionCount--;

    if (_protectionCount === 0) {
        const element = document.getElementById("protection");
        element.classList.remove("active");
        element.onclick = null;
    }
}