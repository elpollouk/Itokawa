import * as crypto from "crypto";
import { parseIntStrict } from "./parsers";

const DEFAULT_COST = 16384;
const HASH_FUNCTION_ID = "scrypt512";

export function scrypt512(password: string, salt: string, cost: number): Promise<string> {
    return new Promise((resolve) => {
        crypto.scrypt(password, salt, 64, { N: cost }, (_err, derivedKey) => {
            let encodedKey = derivedKey.toString('base64');
            // The last two characters are always "==" so get rid of them
            encodedKey = encodedKey.substring(0, encodedKey.length - 2);
            resolve(encodedKey);
        });
    });
}

export async function hash(password: string, cost: number = DEFAULT_COST): Promise<string> {
    const salt = crypto.randomBytes(18).toString("base64");
    const derivedKey = await scrypt512(password, salt, cost);
    // Encode the hash and salt in a way that's easy for us to modify or expand on in the future.
    // This is similar to how bcrypt uses the Modular Crypt format.
    return `$${HASH_FUNCTION_ID}$${cost}$${salt}${derivedKey}`;
}

export async function verify(password: string, hash: string): Promise<boolean> {
    // _empty is used to handle Modular Crypt Format hashes that start with $
    const [empty, scheme, cost, saltAndkey] = hash.split("$");
    if (!!empty || !scheme) throw new Error("Malformed hash");
    if (scheme !== HASH_FUNCTION_ID) throw new Error(`Unknown hash scheme: ${scheme}`);
    if (!saltAndkey || saltAndkey.length !== 110) throw new Error("Invalid salt and hash");

    // The salt and key are simply concattenated together with fixed lengths
    const salt = saltAndkey.substring(0, 24);
    const key = saltAndkey.substring(24);
    const derivedKey = await scrypt512(password, salt, parseIntStrict(cost));
    return key == derivedKey;
}
