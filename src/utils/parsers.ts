const _whitespaceChars = new Set([" ", "\t", "\r", "\n", ""]);

export function splitStringEx(text: string, splitChars: Set<string> | string[], quoteChar: string, escapeChar: string): string[] {
    if (Array.isArray(splitChars)) splitChars = new Set(splitChars);

    text = text || "";
    let commandArgs: string[] = [];
    let currentWord: string = "";
    let quoteMode: boolean = false;

    for (let i = 0; i < text.length; i++) {
        let isEscaped = false;
        let c = text[i];
        if (c === quoteChar) {
            quoteMode = !quoteMode;
            continue;
        }
        if (c === escapeChar) {
            isEscaped = true;
            i++;
            c = text[i] || "";
        }

        if (splitChars.has(c) && !quoteMode && !isEscaped) {
            if (currentWord) {
                commandArgs.push(currentWord);
                currentWord = "";
            }    
        }
        else {
            currentWord += c;
        }
    }

    if (currentWord) commandArgs.push(currentWord);

    return commandArgs;
}

export function parseCommand(command: string): string[] {
    return splitStringEx(command, _whitespaceChars, "\"", "^");
}