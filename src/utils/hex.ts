function leftPad(stringToPad: string, stringToPadWith: string): string {
    return stringToPadWith.slice(stringToPad.length) + stringToPad;
}

export function toHumanHex(data: number[] | Buffer): string {
    let padding = "00";
    let r = leftPad(data[0].toString(16), padding);
    
    for (let i = 1; i < data.length; i++)
        r += `, ${leftPad(data[i].toString(16), padding)}`;
    return r;
}