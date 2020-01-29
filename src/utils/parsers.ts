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

        if (c === " " && !quoteMode && !isEscaped) {
            commandArgs.push(currentWord);
            currentWord = "";
        }
        else {
            currentWord += c;
        }
    }
    commandArgs.push(currentWord);

    commandArgs = commandArgs.filter((s) => !!s);
    if (commandArgs.length == 0) return [];

    return commandArgs;
}