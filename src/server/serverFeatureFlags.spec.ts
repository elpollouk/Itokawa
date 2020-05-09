import { expect } from "chai";
import "mocha";

import { ServerFeatureFlags } from "./serverFeatureFlags";
import { ConfigNode } from "../utils/config";

describe("Server Feature Flags", () => {
    describe("setFRomCommandLine", () => {
        it("should support a single flag", () => {
            const flags = new ServerFeatureFlags();
            flags.setFromCommandLine("bar");

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(1);
            expect(current).to.contain("bar");
        })

        it("should support multiple flags (comma separated)", () => {
            const flags = new ServerFeatureFlags();
            flags.setFromCommandLine("bar,foo,,baz");

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(3);
            expect(current).to.contain("foo");
            expect(current).to.contain("bar");
            expect(current).to.contain("baz");
        })

        it("should support multiple flags (space separated)", () => {
            const flags = new ServerFeatureFlags();
            flags.setFromCommandLine("bar foo  baz");

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(3);
            expect(current).to.contain("foo");
            expect(current).to.contain("bar");
            expect(current).to.contain("baz");
        })

        it("should support multiple flags (mixed)", () => {
            const flags = new ServerFeatureFlags();
            flags.setFromCommandLine("baz, bar foo");

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(3);
            expect(current).to.contain("foo");
            expect(current).to.contain("bar");
            expect(current).to.contain("baz");
        })

        it("should reject an empty string", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromCommandLine("")).to.throw('Invalid flag definitions, ""');
        })

        it("should reject a null string", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromCommandLine(null)).to.throw('Invalid flag definitions, "null"');
        })

        it("should reject an undefined string", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromCommandLine(undefined)).to.throw('Invalid flag definitions, "undefined"');
        })

        it("should reject non-string values", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromCommandLine(4 as any)).to.throw('Invalid flag definitions, "4"');
        })
    })

    describe("setFromConfig", () => {
        it("should accept an empty node", () => {
            const config = new ConfigNode();
            const flags = new ServerFeatureFlags();
            flags.setFromConfig(config);

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(0);
        })

        it("should accept a node with values", () => {
            const config = new ConfigNode();
            config.set("foo", "");
            config.set("bar", new ConfigNode());
            const flags = new ServerFeatureFlags();
            flags.setFromConfig(config);

            const current = new Set(flags.getFlags());
            expect(current.size).to.eql(2);
            expect(current).to.contain("foo");
            expect(current).to.contain("bar");
        })

        it("should reject a null config", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromConfig(null)).to.throw("No config provided");            
        })

        it("should reject a undefined config", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromConfig(undefined)).to.throw("No config provided");            
        })

        it("should reject a non-config value", () => {
            const flags = new ServerFeatureFlags();
            expect(() => flags.setFromConfig("config" as any)).to.throw("No config provided");            
        })
    })
})