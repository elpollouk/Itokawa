export function enableProtection(onclick?: ()=>void) {
    const element = document.getElementById("protection");
    if (element.classList.contains("active")) throw new Error("Protection already active");

    element.classList.add("active");
    element.onclick = onclick;
}

export function disableProtection() {
    const element = document.getElementById("protection");
    if (element.classList.contains("active")) {
        element.classList.remove("active");
        element.onclick = null;
    }
}