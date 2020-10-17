const _whitespaceChars = new Set([" ", "\t", "\r", "\n", ""]);

export function splitStringEx(text: string, splitChars: Set<string> | string[], quoteChar: string, escapeChar: string, preserveSpecials?: boolean, commentChar?: string): string[] {
    if (Array.isArray(splitChars)) splitChars = new Set(splitChars);

    text = text ?? "";
    commentChar = commentChar ?? "";
    let commandArgs: string[] = [];
    let currentWord: string = null;
    let quoteMode: boolean = false;

    for (let i = 0; i < text.length; i++) {
        let isEscaped = false;
        let c = text[i];
        if (c === quoteChar) {
            quoteMode = !quoteMode;
            if (quoteMode) currentWord = currentWord ?? ""; // Allow empty quoted strings
            if (preserveSpecials) currentWord += c;
            continue;
        }
        else if (c === escapeChar) {
            isEscaped = true;
            i++;
            if (preserveSpecials) currentWord += c;
            c = text[i] || "";
        }
        else if (c === commentChar && !quoteMode) {
            break;
        }

        if (splitChars.has(c) && !quoteMode && !isEscaped) {
            if (currentWord !== null) {
                commandArgs.push(currentWord);
                currentWord = null
            }    
        }
        else if (c) {
            currentWord = currentWord ?? "";
            currentWord += c;
        }
    }

    if (currentWord !== null) commandArgs.push(currentWord);

    return commandArgs;
}

export function parseIntStrict(text: string): number {
    const v = parseInt(text);
    if (isNaN(v)) throw Error(`\"${text}\" is not a valid integer`);
    return v;
}

export function parseFloatStrict(text: string): number {
    const v = parseFloat(text);
    if (isNaN(v)) throw Error(`\"${text}\" is not a valid float`);
    return v;
}

export function parseCommand(command: string): string[] {
    return splitStringEx(command, _whitespaceChars, "\"", "^", false, "#");
}

export function parseConnectionString(c: string, fieldParsers?: {[key: string]: (arg:string) => any}): {[key: string]: any} {
    fieldParsers = fieldParsers || {};
    const words = splitStringEx(c, [";"], "\"", "^", true);
    const result = {};
    for (const word of words) {
        const kv = splitStringEx(word, ["="], "\"", "^");
        if (kv.length != 2) throw new Error(`\"${word}\" is not a valid key/value pair`);
        kv[0] = kv[0].trim();
        if (kv[0] in fieldParsers) {
            result[kv[0]] = fieldParsers[kv[0]](kv[1]);
        }
        else {
            result[kv[0]] = kv[1];
        }
    }

    return result;
}