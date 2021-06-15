import * as fs from "fs";

// Use fs.rm on 14+
export function rmdir(path: string): Promise<void> {
    if (fs.promises.rm) {
        return fs.promises.rm(path, {
            recursive: true,
            force: true
        });
    }
    return fs.promises.rmdir(path, {
        recursive: true
    });
}