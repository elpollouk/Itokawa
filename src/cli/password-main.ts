import * as crypto from "crypto";
import { Logger, LogLevel } from "../utils/logger";
Logger.logLevel = LogLevel.DISPLAY;

async function hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // generate random 16 bytes long salt
        const salt = crypto.randomBytes(16).toString("hex")

        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(salt + ":" + derivedKey.toString('hex'))
        });
    })
}

async function verify(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(":")
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(key == derivedKey.toString('hex'))
        });
    })
}

async function main() {
    console.log("Hello World");

    const password = "abcd1234";
    const hashed = await hash(password);
    console.log(`${password} -> ${hashed}`);

    const verified = await verify(password, hashed);
    console.log(`Verified = ${verified}`);
}

main().catch((err) => {
    if (err.stack) console.error(err.stack);
    else console.error(err);
    process.exit(1);
});