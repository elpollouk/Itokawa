import { expect } from "chai";
import "mocha";
import * as password from "./password";

const TEST_PASSWORD = 'tEsT1_!{ "';
const TEST_HASH = "$scrypt512$16384$dqTFQcWIpJ0tXeUKoC8v6ZSO$ipUfahbaUBMhC2vfgVqh34D/wb3ts6neX2k+tHMIGZwddJkVvkfg+FTyIGItDuSbkxXknAc51o7OI3rxA4pTzA==";

describe("Password", () => {
    describe("hash", () => {
        it("should generate a hash in the crrect format - Default cost", async () => {
            const hash = await password.hash(TEST_PASSWORD);
            const parts = hash.split("$");

            expect(parts).to.have.length(5);
            expect(parts[0]).to.be.empty;
            expect(parts[1]).to.equal("scrypt512");     // Hash scheme
            expect(parts[2]).to.equal("16384");         // Cost
            expect(parts[3]).to.have.length(24);        // Salt
            expect(parts[4]).to.have.length(88);        // Hash
        })

        it("should generate a hash in the crrect format - Explicit cost", async () => {
            const hash = await password.hash(TEST_PASSWORD, 256);
            const parts = hash.split("$");

            expect(parts).to.have.length(5);
            expect(parts[0]).to.be.empty;
            expect(parts[1]).to.equal("scrypt512");     // Hash scheme
            expect(parts[2]).to.equal("256");           // Cost
            expect(parts[3]).to.have.length(24);        // Salt
            expect(parts[4]).to.have.length(88);        // Hash
        })

        it("should generate a new hash each time for the same password", async () => {
            const [empty1, scheme1, cost1, salt1, key1] = (await password.hash(TEST_PASSWORD)).split("$");
            const [empty2, scheme2, cost2, salt2, key2] = (await password.hash(TEST_PASSWORD)).split("$");

            expect(empty1).to.equal(empty2);
            expect(scheme1).to.equal(scheme2);
            expect(cost1).to.equal(cost2);
            expect(salt1).to.not.equal(salt2);
            expect(key1).to.not.equal(key2);
        })
    })

    describe("verify", () => {
        it("should be able to verify a hashed password", async () => {
            await expect(password.verify(TEST_PASSWORD, TEST_HASH)).to.be.eventually.true;
        })

        it("should reject an incorrect password", async () => {
            await expect(password.verify("bad", TEST_HASH)).to.be.eventually.false;
        })

        it("should reject incorrect hash scheme", async () => {
            // Test with a bcrypt has
            await expect(password.verify("test", "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")).to.be.eventually.rejectedWith("Unknown hash scheme: 2a");
        })

        it("should reject a malformed hash", async () => {
            await expect(password.verify("test", "bad hash")).to.be.eventually.rejectedWith("Malformed hash");
        })

        it("should reject a pre-pended hash", async () => {
            await expect(password.verify(TEST_PASSWORD, "bad" + TEST_HASH)).to.be.eventually.rejectedWith("Malformed hash");
        })

        it("should reject an empty cost", async () => {
            await expect(password.verify("test", "$scrypt512$$salt$key")).to.be.eventually.rejectedWith(`"" is not a valid integer`);
        })

        it("should reject a non-integer cost", async () => {
            await expect(password.verify("test", "$scrypt512$foo$salt$key")).to.be.eventually.rejectedWith(`"foo" is not a valid integer`);
        })

        it("should reject a negative cost", async () => {
            await expect(password.verify("test", "$scrypt512$-1$salt$key")).to.be.eventually.rejectedWith(/out of range/);
        })

        it("should reject an empty salt", async () => {
            await expect(password.verify("test", "$scrypt512$128$$key")).to.be.eventually.rejectedWith("Invalid salt");
        })

        it("should reject an empty key", async () => {
            await expect(password.verify("test", "$scrypt512$128$salt$")).to.be.eventually.rejectedWith("Invalid key");
        })
    })

    describe("scrypt", () => {
        it("should return a valid key", async () => {
            const key = await password.scrypt("test", "0123456789ABCDEF", 128);
            expect(key).to.have.length(88);
        })

        it("should reject invalid cost values", async () => {
            await expect(password.scrypt("test", "01234567890ABCDEF", 20000)).to.be.eventually.rejectedWith("Invalid scrypt parameter");
        })

        it("should reject on too much memory use", async () => {
            await expect(password.scrypt("test", "01234567890ABCDEF", 32768)).to.be.eventually.rejectedWith(/memory limit exceeded/);
        })

        it("should reject a null password", async () => {
            await expect(password.scrypt(null, "01234567890ABCDEF", 128)).to.be.eventually.rejectedWith(/The "password" argument must be one of type string, Buffer, TypedArray, or DataView/);
        });

        it("should reject a null salt", async () => {
            await expect(password.scrypt("test", null, 128)).to.be.eventually.rejectedWith(/The "salt" argument must be one of type string, Buffer, TypedArray, or DataView/);
        });
    })
})
