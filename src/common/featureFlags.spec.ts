import { expect } from "chai";
import "mocha";

import {FeatureFlags } from "./featureFlags";


describe("Feature Flags", () => {
    describe("set", () => {
        it("should accept a valid string", () => {
            const flags = new FeatureFlags();
            flags.set("foo");
        })

        it("should accept an array for strings", () => {
            const flags = new FeatureFlags();
            flags.set(["a", "b", "c"]);

            expect(flags.isSet("a")).to.be.true;
            expect(flags.isSet("b")).to.be.true;
            expect(flags.isSet("c")).to.be.true;
        })

        it("should reject an empty string", () => {
            const flags = new FeatureFlags();
            expect(() => flags.set("")).to.throw('Invalid flag name, "" is not a valid string');
        })

        it("should reject a null value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.set(null)).to.throw('Invalid flag name, "null" is not a valid string');
        })

        it("should reject an undefined value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.set(undefined)).to.throw('Invalid flag name, "undefined" is not a valid string');
        })

        it("should reject a numeric value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.set(12 as any)).to.throw('Invalid flag name, "12" is not a valid string');
        })
    })

    describe("isSet", () => {
        it("should report true for only set flags", () => {
            const flags = new FeatureFlags();
            flags.set("bar");

            expect(flags.isSet("foo")).to.be.false;
            expect(flags.isSet("bar")).to.be.true;
        })

        it("should reject an empty string", () => {
            const flags = new FeatureFlags();
            expect(() => flags.isSet("")).to.throw('Invalid flag name, "" is not a valid string');
        })

        it("should reject a null value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.isSet(null)).to.throw('Invalid flag name, "null" is not a valid string');
        })

        it("should reject an undefined value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.isSet(undefined)).to.throw('Invalid flag name, "undefined" is not a valid string');
        })

        it("should reject a numeric value", () => {
            const flags = new FeatureFlags();
            expect(() => flags.isSet(12 as any)).to.throw('Invalid flag name, "12" is not a valid string');
        })
    })

    describe("getFlags", () => {
        it("should return an empty iterator if no flags set", () => {
            const flags = new FeatureFlags();
            const itor = flags.getFlags();
            expect(itor.next()).to.eql({ value: undefined, done: true });
        })

        it("should return only flags that have been see", () => {
            const flags = new FeatureFlags();
            flags.set("foo");
            flags.set("bar");

            const itor = flags.getFlags();
            const set = new Set(itor);
            expect(set.size).to.equal(2);
            expect(set.has("foo")).to.be.true;
            expect(set).to.contain("bar");
        })
    })
})