import * as fs from "fs";
import { timestamp } from "../common/time";

type EntryFormatter = (data: any[])=>string;

class DebugEntry {
    timestamp: string;
    constructor(public data: any[]) {
        this.timestamp = timestamp();
    }

    format(formatter: EntryFormatter): string {
        return `${this.timestamp}: ${formatter(this.data)}`;
    }
}

export class DebugSnapshot {
    private readonly _entries: DebugEntry[] = [];

    constructor(private readonly _maxEntries: number, private readonly _formatter: EntryFormatter) {
        if (_maxEntries <= 0) throw new Error("Max number of entries must be positive");
        if (!_formatter) throw new Error("Formatter must not be null");
    }

    add(...data: any[]) {
        const debugEntry = new DebugEntry(data);
        while (this._entries.length >= this._maxEntries) {
            this._entries.shift();
        }

        this._entries.push(debugEntry);
    }

    save(filename: string) {
        const filedata: string[] = [];
        for (const entry of this._entries) {
            filedata.push(entry.format(this._formatter));
        }

        fs.writeFileSync(filename, filedata.join("\n"));
    }
}