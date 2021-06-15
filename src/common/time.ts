function padZero(number: number, size?: number) {
    size = size || 2;
    return ("00" + number).substr(-size);
}

export function timestamp(): string {
    const d = new Date()
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth()+1);
    const date = padZero(d.getUTCDate());
    const hours = padZero(d.getUTCHours());
    const mins = padZero(d.getUTCMinutes());
    const seconds = padZero(d.getUTCSeconds());
    const ms = padZero(d.getUTCMilliseconds(), 3);
    return `${year}-${month}-${date}T${hours}:${mins}:${seconds}.${ms}Z`;
}

export function timestampShort(): string {
    const d = new Date()
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth()+1);
    const date = padZero(d.getUTCDate());
    const hours = padZero(d.getUTCHours());
    const mins = padZero(d.getUTCMinutes());
    const seconds = padZero(d.getUTCSeconds());
    return `${year}${month}${date}${hours}${mins}${seconds}`;
}