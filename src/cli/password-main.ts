import * as path from "path";
import { read } from "read";
import { initDataDirectory } from "../application";
import { ADMIN_PASSWORD_KEY } from "../server/sessionmanager";
import { loadConfig, saveConfig } from "../utils/config";
import { Logger, LogLevel } from "../utils/logger";
import * as password from "../utils/password";
Logger.logLevel = LogLevel.DISPLAY;

const CONFIG_XML = "config.xml";

async function readPassword(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        read({ prompt: prompt, silent: true, replace: "*" }, function(err, password) {
            if (err) reject(err);
            else resolve(password);
        });
    });
}

async function main() {
    const pass = await readPassword("New admin password: ");
    if (!pass) {
        console.error("No password provided!");
        process.exit(1);
    }

    const check = await readPassword("Repeat password: ");
    if (pass !== check) {
        console.error("Passwords did not match!");
        process.exit(1);
    }

    const hashed = await password.hash(pass);

    // This is a sanity check to make sure we can verify the password in future
    if (!await password.verify(pass, hashed)) throw new Error("Hash was not verified");

    // Load up the config file directly to set the admin password
    let configPath = initDataDirectory();
    configPath = path.join(configPath, CONFIG_XML);
    console.log(`Modifying ${configPath}...`);
    const config = await loadConfig(configPath);
    config.set(ADMIN_PASSWORD_KEY, hashed);
    await saveConfig(configPath, config);

    console.log("Config updated!");
}

main().catch((err) => {
    if (err.stack) console.error(err.stack);
    else console.error(err);
    process.exit(1);
});
