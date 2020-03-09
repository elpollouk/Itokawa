const padString = "0000000";

export function padLeadingZero(value: number, width: number) {
    if (width < 2 || width > padString.length + 1) throw("Unsupported pad width");

    let s = `${Math.abs(value)}`;

    if (s.length < width) {
        s = padString + s;
        s = s.substring(s.length - width);
    }

    if (value < 0)
        s = `-${s}`;

    return s;
}