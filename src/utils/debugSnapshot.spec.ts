import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";

import * as fs from "fs";
import * as time from "../common/time";
import { DebugSnapshot } from "./debugSnapshot";

describe("DebugSnapshot", () => {
    describe("Construct", () => {
        it("should accept valid paramters", () => {
            new DebugSnapshot(4, stub());
        })

        it("should reject invalid max snapshot size (zero)", () => {
            expect(() => new DebugSnapshot(0, stub())).to.throw("Max number of entries must be positive");
        })

        it("should reject invalid max snapshot size (negative)", () => {
            expect(() => new DebugSnapshot(-1, stub())).to.throw("Max number of entries must be positive");
        })

        it("should reject null formatter", () => {
            expect(() => new DebugSnapshot(1, null)).to.throw("Formatter must not be null");
        })
    })

    describe("Add and save", () => {
        let writeFileSyncStub: SinonStub;
        let timestampStub: SinonStub;
        let timestampCount = 0;

        function formatter(data: any[]) {
            const line: string[] = [];
            line.push('<');
            line.push(`${data[0]}`);
            for (let i = 1; i < data.length; i++) {
                line.push(" - ");
                line.push(`${data[i]}`);
            }
            line.push('>');
            return line.join("");
        }

        beforeEach(() => {
            writeFileSyncStub = stub(fs, "writeFileSync");
            timestampStub = stub(time, "timestamp").callsFake(() => {
                return `${timestampCount++}`;
            });
            timestampCount = 0;
        })

        afterEach(() => {
            writeFileSyncStub.restore();
            timestampStub.restore();
        })

        it("should write an empty file is no items", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.save("test1.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test1.txt", ""]);
        })

        it("should write an file containing available data if fewer than max entries added", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.add("a");
            snapshot.add("b");
            snapshot.save("test2.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test2.txt", "0: <a>\n1: <b>"]);
        })

        it("should write an file all data if max entries added", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.add("c");
            snapshot.add("d");
            snapshot.add("e");
            snapshot.add("f");
            snapshot.save("test3.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test3.txt", "0: <c>\n1: <d>\n2: <e>\n3: <f>"]);
        })

        it("should write an file with most recent data if max entries exceeded", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.add("g");
            snapshot.add("h");
            snapshot.add("i");
            snapshot.add("j");
            snapshot.add("k");
            snapshot.add("l");
            snapshot.save("test4.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test4.txt", "2: <i>\n3: <j>\n4: <k>\n5: <l>"]);
        })

        it("should write an file with most recent data if max entries exceeded", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.add("g");
            snapshot.add("h");
            snapshot.add("i");
            snapshot.add("j");
            snapshot.add("k");
            snapshot.add("l");
            snapshot.save("test4.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test4.txt", "2: <i>\n3: <j>\n4: <k>\n5: <l>"]);
        })

        it("should handle multiple data args", () => {
            const snapshot = new DebugSnapshot(4, formatter);
            
            snapshot.add("a", "b");
            snapshot.add("c", "d", "e");
            snapshot.save("test5.txt");

            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["test5.txt", "0: <a - b>\n1: <c - d - e>"]);
        })
    })
})