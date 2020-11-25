import * as crypto from "crypto";
import { parseIntStrict } from "./parsers";

const DEFAULT_COST = 16384;
const HASH_FUNCTION_ID = "scrypt512";

export function scrypt(password: string, salt: string, cost: number): Promise<string> {
    return new Promise((resolve) => {
        crypto.scrypt(password, salt, 64, { N: cost }, (_err, derivedKey) => {
            resolve(derivedKey.toString('base64'));
        });
    });
}

export async function hash(password: string, cost: number = DEFAULT_COST): Promise<string> {
    const salt = crypto.randomBytes(18).toString("base64");
    const derivedKey = await scrypt(password, salt, cost);
    // Encode the hash and salt in a way that's easy for us to modify or expand on in the future
    return `$${HASH_FUNCTION_ID}$${cost}$${salt}$${derivedKey}`;
}

export async function verify(password: string, hash: string): Promise<boolean> {
    // _empty is used to handle Modular Crypt Format hashes that start with $
    const [empty, scheme, cost, salt, key] = hash.split("$");
    if (!!empty || !scheme) throw new Error("Malformed hash");
    if (scheme !== HASH_FUNCTION_ID) throw new Error(`Unknown hash scheme: ${scheme}`);
    if (!salt) throw new Error("Invalid salt");
    if (!key) throw new Error("Invalid key");
    const derivedKey = await scrypt(password, salt, parseIntStrict(cost));
    return key == derivedKey;
}
