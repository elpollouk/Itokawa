import { expect } from "chai";
import "mocha";
import "./parsers";
import { parseCommand, splitStringEx, parseConnectionString, parseIntStrict, parseFloatStrict } from "./parsers";

describe("Parsers", () => {

    describe("SplitStringEx", () => {
        it("should handle arbitary formats", () => {
            const result = splitStringEx("a: &b c\nd&  :f*:*&&:**:", [":"], "&", "*");
            expect(result).to.eql([
                "a",
                " b c\nd  ",
                "f:&:*:"
            ]);
        })

        it("should handle empty strings", () => {
            const result = splitStringEx("", [":"], "&", "*");
            expect(result).to.be.empty;
        })

        it("should handle null strings", () => {
            const result = splitStringEx(null, [":"], "&", "*");
            expect(result).to.be.empty;
        })
    })

    describe("Primitive Parsers", () => {
        describe("parseFloatStrict", () => {
            it("should handle valid floats", () => {
                expect(parseFloatStrict("123.45")).to.equal(123.45);
            })

            it("should reject invalid floats", () => {
                expect(() => parseFloatStrict("foo")).to.throw("\"foo\" is not a valid float");
            })
        });

        describe("parseIntStrict", () => {
            it("should handle valid floats", () => {
                expect(parseIntStrict("357")).to.equal(357);
            })

            it("should reject invalid floats", () => {
                expect(() => parseIntStrict("bar")).to.throw("\"bar\" is not a valid integer");
            })
        });
    })

    describe("Command Parser", () => {

        it("should parse simple format commands", () => {
            const result = parseCommand("a b c");
            expect(result).to.eql(["a", "b", "c"]);
        });

        it("should parse command with quoted words", () => {
            const result = parseCommand("one  \"two three\" four");
            expect(result).to.eql(["one", "two three", "four"]);
        });

        it("should parse completely quoted command", () => {
            const result = parseCommand("\"one  two  three  four\"");
            expect(result).to.eql(["one  two  three  four"]);
        });

        it("should parse command with embedded quotes within words", () => {
            const result = parseCommand("*\"Hello World\"!!*");
            expect(result).to.eql(["*Hello World!!*"]);
        });

        it ("should parse unbalanced quotes", () => {
            const result = parseCommand("\"this is\" \"another test");
            expect(result).to.eql(["this is", "another test"]);
        })

        it("should parse escaped quotes", () => {
            const result = parseCommand("\"this is a quote: '^\"'\" another^\"quote");
            expect(result).to.eql(["this is a quote: '\"'", "another\"quote"]);
        })

        it("should parse escaped hat", () => {
            const result = parseCommand("\"This is a hat: '^^'\" ^^");
            expect(result).to.eql(["This is a hat: '^'", "^"]);
        })

        it("should parse any escaped chat", () => {
            const result = parseCommand("^a^b^c^ ^d^e^f");
            expect(result).to.eql(["abc def"]);
        })

        it("should not fail if hat is last character of string", () => {
            const result = parseCommand("a b c ^ ");
            expect(result).to.eql(["a", "b", "c", " "]);
        })

        it("should parse escaped space as last word", () => {
            const result = parseCommand("a b c ^");
            expect(result).to.eql(["a", "b", "c"]);
        })

        it("should handle tripple escape characters", () => {
            const result = parseCommand("^^^a ^^^  ^^^\"");
            expect(result).to.eql(["^a", "^ ", "^\""]);
        })

        it("should parse strings with multiple spaces separating words", () => {
            const result = parseCommand("   foo   bar  ");
            expect(result).to.eql(["foo", "bar"]);
        })

        it("should parse empty strings", () => {
            const result = parseCommand("");
            expect(result).to.eql([]);
        })

        it("should parse strings with only strings", () => {
            const result = parseCommand("    ");
            expect(result).to.eql([]);
        })

        it("should parse null strings", () => {
            const result = parseCommand(null);
            expect(result).to.eql([]);
        })

        it("should trim out all white space", () => {
            const result = parseCommand("\n\r\ta\t\r\nb\n\r\tc\r\n\t");
            expect(result).to.eql(["a", "b", "c"]);
        });
    });

    describe("Connection String Parser", () => {
        it("should correclty parse out string values", () => {
            const config = parseConnectionString("a=foo;b=bar");
            expect(config).to.eql({
                a: "foo",
                b: "bar"
            });
        })

        it("should correclty handle single value strings", () => {
            const config = parseConnectionString("abc=def");
            expect(config).to.eql({
                abc: "def"
            });
        })

        it("should correclty handle trailing semicolons", () => {
            const config = parseConnectionString("abc=def;");
            expect(config).to.eql({
                abc: "def"
            });
        })

        it("should correcly handle custom field parsers", () => {
            const config = parseConnectionString("path=COM3;timeout=30;threshold=0.8;foo=bar", {
                timeout: parseIntStrict,
                threshold: parseFloatStrict,
                foo: () => "baz"
            });
            expect(config).to.eql({
                path: "COM3",
                timeout: 30,
                threshold: 0.8,
                foo: "baz"
            });
        })

        it("should handle quotes", () => {
            const config = parseConnectionString("\"a=b;c=d;\"=f\";g=h;\"k;foo=bar");
            expect(config).to.eql({
                "a=b;c=d;": "f;g=h;k",
                foo: "bar"
            });
        })

        it("should handle escaped characters", () => {
            const config = parseConnectionString("a^=b=c^=d^;e^=f;bar=foo");
            expect(config).to.eql({
                "a=b": "c=d;e=f",
                "bar": "foo"
            });
        })

        it("should reject incorrectly formatted string", () => {
            expect(() => parseConnectionString("a=b=c")).to.throw("\"a=b=c\" is not a valid key/value pair");
        })
    });

});