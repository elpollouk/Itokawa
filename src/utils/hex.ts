function leftPad(stringToPad: string, stringToPadWith: string): string {
    return stringToPadWith.slice(stringToPad.length) + stringToPad;
}

export function toHumanHex(data: number[] | Buffer): string {
    if (data.length === 0) return "";
    
    let padding = "00";
    let r = leftPad(data[0].toString(16), padding);
    
    for (let i = 1; i < data.length; i++)
        r += `, ${leftPad(data[i].toString(16), padding)}`;
    return r;
}

function hexCharToValue(char: string):number {
    const value = char.charCodeAt(0);
    if (48 <= value && value <= 57) { // '0'..'9'
        return value - 48;
    }
    else if (65 <= value && value <= 70) { // 'A'..'F'
        return value - 55
    }
    else if (97 <= value && value <= 102) { // 'a'..'f'
        return value - 87;
    }
    throw new Error(`'${char}' is not a valid hex char`);
}

export function fromHex(hex: string): number[] {
    const data: number[] = [];

    let value = 0;
    let upper = true;
    for (let i = 0; i < hex.length; i++) {
        const c = hex[i];
        if (c === " " || c === "\n") continue;

        if (upper) {
            value = hexCharToValue(c) << 4;
        }
        else {
            value |= hexCharToValue(c);
            data.push(value);
        }
        upper = !upper;
    }

    if (!upper) throw new Error("Incomplete hex string");

    return data;
}