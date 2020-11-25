import * as crypto from "crypto";
import * as path from "path";
import * as read from "read";
import { initDataDirectory } from "../application";
import { loadConfig, saveConfig } from "../utils/config";
import { Logger, LogLevel } from "../utils/logger";
import { parseIntStrict } from "../utils/parsers";
Logger.logLevel = LogLevel.DISPLAY;

const DEFAULT_COST = 16384;
const CONFIG_XML = "config.xml";
const HASH_FUNCTION_ID = "scrypt512";

async function readPassword(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        read({ prompt: prompt, silent: true, replace: "*" }, function(err, password) {
            if (err) reject(err);
            else resolve(password);
        });
    });
}

function scrypt(password: string, salt: string, cost: number): Promise<string> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, { N: cost }, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey.toString('base64'));
        });
    });
}

async function hash(password: string, cost: number = DEFAULT_COST): Promise<string> {
    const salt = crypto.randomBytes(18).toString("base64");
    const derivedKey = await scrypt(password, salt, cost);
    // Encode the hash and salt in a way that's easy for us to modify or expand on in the future
    return `${HASH_FUNCTION_ID}$${cost}$${salt}$${derivedKey}`;
}

async function verify(password: string, hash: string): Promise<boolean> {
    const [type, cost, salt, key] = hash.split("$");
    if (type !== HASH_FUNCTION_ID) throw new Error(`Unknown hash function: ${type}`);
    const derivedKey = await scrypt(password, salt, parseIntStrict(cost));
    return key == derivedKey;
}

async function main() {
    const password = await readPassword("New admin password: ");
    if (!password) {
        console.error("No password provided!");
        process.exit(1);
    }

    const check = await readPassword("Repeat password: ");
    if (password !== check) {
        console.error("Passwords did not match!");
        process.exit(1);
    }

    const hashed = await hash(password);

    // This is a sanity check to make sure we can verify the password in future
    if (!await verify(password, hashed)) throw new Error("Hash was not verified");

    // Load up the config file directly to set the admin password
    let configPath = initDataDirectory();
    configPath = path.join(configPath, CONFIG_XML);
    console.log(`Modifying ${configPath}...`);
    const config = await loadConfig(configPath);
    config.set("server.admin.password", hashed);
    await saveConfig(configPath, config);

    console.log("Config updated!");
}

main().catch((err) => {
    if (err.stack) console.error(err.stack);
    else console.error(err);
    process.exit(1);
});
