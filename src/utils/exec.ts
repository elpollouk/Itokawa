import { exec, spawn } from "child_process";
import { nextTick } from "./promiseUtils";
import { Logger } from "./logger";

const log = new Logger("Exec");

export function execAsync(command: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        log.info(`Executing: ${command}`);

        const proc = exec(command, (err, stdout, stderr) => {
            if (stderr) log.error(`stderr=${stderr}`);
            if (stdout) log.info(`stdout=${stdout}`);
            if (err) reject(err);
            else resolve(stdout);
        });
        proc.on("exit", (code) => {
            log.info(`Process exit code: ${code}`);
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
}

type OutputCallback = (data: string)=>void;
export function spawnAsync(command: string, onStdOut: OutputCallback, onStdErr: OutputCallback): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const proc = spawn(command, {
            shell: true,
            windowsHide: true 
        });
        proc.on("exit", async (code) => {
            await nextTick();
            resolve(code);
        });
        proc.stdout.on("data", (data) => {
            if (data instanceof Buffer) data = data.toString("utf8");
            onStdOut(data);
        });
        proc.stderr.on("data", (data) => {
            if (data instanceof Buffer) data = data.toString("utf8");
            onStdErr(data);
        });
    });
}