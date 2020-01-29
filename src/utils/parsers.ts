const _whitespaceChars = new Set([" ", "\t", "\r", "\n", ""]);

export function parseCommand(command: string): string[] {
    command = command || "";
    let commandArgs: string[] = [];
    let currentWord: string = "";
    let quoteMode: boolean = false;

    for (let i = 0; i < command.length; i++) {
        let isEscaped = false;
        let c = command[i];
        if (c === "\"") {
            quoteMode = !quoteMode;
            continue;
        }
        if (c === "^") {
            isEscaped = true;
            i++;
            c = command[i] || "";
        }

        if (_whitespaceChars.has(c) && !quoteMode && !isEscaped) {
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