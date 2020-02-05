import { exec } from "child_process";
import { Logger } from "./logger";

const log = new Logger("Exec");

export function execAsync(command: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            log.info(`Executing: ${command}`);

            let rejected = false;
            const proc = exec(command, (err, stdout, stderr) => {
                if (err) reject(err);
                if (stderr) log.error(`stderr=${stderr}`);
                if (stdout) log.info(`stdout=${stdout}`);
                if (!rejected) {
                    if (err) reject(err);
                    else resolve(stdout);
                } 
            });
            proc.on("exit", (code) => {
                log.info(`Process exit code: ${code}`);
                if (code !== 0) {
                    rejected = true;
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
        }
        catch (ex) {
            reject(ex);
        }
    });
}
