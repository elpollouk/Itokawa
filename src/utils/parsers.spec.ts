import { expect } from "chai";
import "mocha";
import "./parsers";
import { parseCommand } from "./parsers";

describe("Parsers", () => {

    describe("Command Parser", () => {

        it("Should parse simple format commands", () => {
            const result = parseCommand("a b c");
            expect(result).to.eql(["a", "b", "c"]);
        });

        it("Should parse command with quoted words", () => {
            const result = parseCommand("one  \"two three\" four");
            expect(result).to.eql(["one", "two three", "four"]);
        });

        it("Should parse completely quoted command", () => {
            const result = parseCommand("\"one  two  three  four\"");
            expect(result).to.eql(["one  two  three  four"]);
        });

        it("Should parse command with embedded quotes within words", () => {
            const result = parseCommand("*\"Hello World\"!!*");
            expect(result).to.eql(["*Hello World!!*"]);
        });

        it ("should parse unbalanced quotes", () => {
            const result = parseCommand("\"this is\" \"another test");
            expect(result).to.eql(["this is", "another test"]);
        })

        it ("should parse escaped quotes", () => {
            const result = parseCommand("\"this is a quote: '^\"'\" another^\"quote");
            expect(result).to.eql(["this is a quote: '\"'", "another\"quote"]);
        })

        it ("should parse escaped hat", () => {
            const result = parseCommand("\"This is a hat: '^^'\" ^^");
            expect(result).to.eql(["This is a hat: '^'", "^"]);
        })

        it ("should parse any escaped chat", () => {
            const result = parseCommand("^a^b^c^ ^d^e^f");
            expect(result).to.eql(["abc def"]);
        })

        it ("should not fail if hat is last character of string", () => {
            const result = parseCommand("a b c ^ ");
            expect(result).to.eql(["a", "b", "c", " "]);
        })

        it ("should parse escaped space as last word", () => {
            const result = parseCommand("a b c ^");
            expect(result).to.eql(["a", "b", "c"]);
        })

        it ("should handle tripple escape characters", () => {
            const result = parseCommand("^^^a ^^^  ^^^\"");
            expect(result).to.eql(["^a", "^ ", "^\""]);
        })

        it ("should parse strings with multiple spaces separating words", () => {
            const result = parseCommand("   foo   bar  ");
            expect(result).to.eql(["foo", "bar"]);
        })

        it ("should parse empty strings", () => {
            const result = parseCommand("");
            expect(result).to.eql([]);
        })

        it ("should parse strings with only strings", () => {
            const result = parseCommand("    ");
            expect(result).to.eql([]);
        })

        it ("should parse null strings", () => {
            const result = parseCommand(null);
            expect(result).to.eql([]);
        })
    });

});