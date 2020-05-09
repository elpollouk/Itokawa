import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub } from "sinon";

import * as fs from "fs";
import { ConfigNode, loadConfig, saveConfig } from "./config";


const TEST_CONFIG = '<config><endpoint><publish><ngrok/></publish></endpoint>'
                  + '<test1 type="bool">true</test1><test2 type="number">123</test2><test3>foo bar</test3>'
                  + '<nested><A>a</A><B>b</B><C>c</C></nested>'
                  + '</config>';

describe("Config", () => {
    describe("ConfigNode", () => {
        describe("get", () => {
            it("should get node missing value", () => {
                const node = new ConfigNode();

                expect(node.get("foo")).to.be.undefined;
            })

            it("should get node number value", () => {
                const node = new ConfigNode();
                node["foo"] = 123.45;

                expect(node.get("foo")).to.equal(123.45);
            })

            it("should get node number value even if default specified", () => {
                const node = new ConfigNode();
                node["foo"] = 1337;

                expect(node.get("foo", 123.45)).to.equal(1337);
            })

            it("should get node default number value", () => {
                const node = new ConfigNode();

                expect(node.get("foo", 357)).to.equal(357);
            })

            it("should get node string value", () => {
                const node = new ConfigNode();
                node["foo"] = "bar";

                expect(node.get("foo")).to.equal("bar");
            })

            it("should get node string value even if default specified", () => {
                const node = new ConfigNode();
                node["foo"] = "baz";

                expect(node.get("foo", "bar")).to.equal("baz");
            })

            it("should get node default string value", () => {
                const node = new ConfigNode();

                expect(node.get("foo", "default")).to.equal("default");
            })

            it("should get node ConfigNode value", () => {
                const node = new ConfigNode();
                const valueNode = new ConfigNode();
                node["foo"] = valueNode;

                expect(node.get("foo")).to.equal(valueNode);
            })

            it("should get node ConfigNode value even if default specified", () => {
                const node = new ConfigNode();
                const valueNode = new ConfigNode();
                node["foo"] = valueNode;
                valueNode["test"] = true;

                expect(node.get("foo", new ConfigNode())).to.equal(valueNode);
            })

            it("should get node default ConfigNode value", () => {
                const node = new ConfigNode();
                const valueNode = new ConfigNode();

                expect(node.get("foo", valueNode)).to.equal(valueNode);
            })

            it("should get nested number value", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                const bar = new ConfigNode();
                node["foo"] = foo;
                foo["bar"] = bar;
                bar["baz"] = 7.11;

                expect(node.get("foo.bar.baz")).to.equal(7.11);
            })

            it("should get nested default ConfigNode value", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                const bar = new ConfigNode();
                node["foo"] = foo;
                bar["baz"] = false;

                expect(node.get("foo.bar.baz", bar)).to.equal(bar);
            })

            it("should get nested default value if there is a path collision", () => {
                const node = new ConfigNode();
                node["foo"] = 12;

                expect(node.get("foo.bar", "default")).to.equal("default");
            })

            it("should handle escaped characters in path", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                node[".foo bar."] = foo;
                foo["bar.baz"] = "test";

                expect(node.get('".foo bar.".bar^.baz')).to.equal("test");
            })
        })

        describe("getAs", () => {
            it("should make tsc happy", () => {
                const node = new ConfigNode();
                node["foo"] = 123.45
                const value: number = node.getAs<number>("foo");

                expect(value).to.equal(123.45);
            })
        })

        describe("set", () => {
            it("should set immediate node number value", () => {
                const node = new ConfigNode();
                node.set("foo", 42);

                expect(node["foo"]).to.equal(42);
            })

            it("should set immediate node string value", () => {
                const node = new ConfigNode();
                node.set("foo", "bar");

                expect(node["foo"]).to.equal("bar");
            })

            it("should set immediate node boolean value", () => {
                const node = new ConfigNode();
                node.set("foo", true);

                expect(node["foo"]).to.equal(true);
            })

            it("should set immediate node ConfigNode value", () => {
                const node = new ConfigNode();
                const valueNode = new ConfigNode();
                valueNode["bar"] = true
                node.set("foo", valueNode);

                expect(node["foo"]).to.equal(valueNode);
            })

            it("should set nested value in existing nodes", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                const bar = new ConfigNode();
                node["foo"] = foo;
                foo["bar"] = bar;
                bar["baz"] = 321.32;
                node.set("foo.bar.baz", 57.911);

                expect(bar["baz"]).to.equal(57.911);
            })

            it("should create and set nested value in missing nodes", () => {
                const node = new ConfigNode();
                node.set("foo.bar.baz", "test");

                expect(node["foo"]["bar"]["baz"]).to.equal("test");
            })

            it("should overwrite non-node values if setting a clashing path", () => {
                const node = new ConfigNode();
                node["foo"] = "not node";
                node.set("foo.bar", 123.456);

                expect(node["foo"]["bar"]).to.equal(123.456);
            })

            it("should handle escaped key values", () => {
                const node = new ConfigNode();
                node.set('"...".^ ', "test");

                expect(node["..."][" "]).to.equal("test");
            });
        })

        describe("has", () => {
            it("should return false for missing immediate value", () => {
                const node = new ConfigNode();

                expect(node.has("foo")).to.be.false;
            })

            it("should return false for missing nested value", () => {
                const node = new ConfigNode();

                expect(node.has("foo.bar")).to.be.false;
            })

            it("should return false for partial nested value", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                node["foo"] = foo;

                expect(node.has("foo.bar")).to.be.false;
            })

            it("should return true for immediate value", () => {
                const node = new ConfigNode();
                node["foo"] = "test";

                expect(node.has("foo")).to.be.true;
            })

            it("should return true for partial path", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                const bar = new ConfigNode();
                const baz = new ConfigNode();
                node["foo"] = foo;
                foo["bar"] = bar;
                bar["baz"] = baz;

                expect(node.has("foo.bar")).to.be.true;
            })

            it("should return true for full path match", () => {
                const node = new ConfigNode();
                const foo = new ConfigNode();
                const bar = new ConfigNode();
                const baz = new ConfigNode();
                node["foo"] = foo;
                foo["bar"] = bar;
                bar["baz"] = baz;

                expect(node.has("foo.bar.baz")).to.be.true;
            })
        })

        describe("keys", () => {
            it("should return an emptry itorator if node is empty", () => {
                const node = new ConfigNode();
                const itor = node.keys();
                expect(itor.next()).to.eql({ value: undefined, done: true });
            })

            it("should return an itorator over set items", () => {
                const node = new ConfigNode();
                node.set("foo", "test");
                node.set("bar.baz", "test");

                const set = new Set(node.keys());
                expect(set.size).to.equal(2);
                expect(set).to.contain("foo");
                expect(set).to.contain("bar");
            })
        })
    })

    describe("loadConfig", () => {
        let readFsStub: SinonStub;
        let existsFsStub: SinonStub;

        beforeEach(() => {
            readFsStub = stub(fs, "readFileSync").returns(TEST_CONFIG);
            existsFsStub = stub(fs, "existsSync").returns(true);
        })

        afterEach(() => {
            readFsStub.restore();
            existsFsStub.restore();
        })

        it("should correctly parse an XML config from disk", async () => {
            const config = await loadConfig("test/path/config.xml");

            expect(readFsStub.callCount).to.equal(1);
            expect(readFsStub.lastCall.args).to.eql([
                "test/path/config.xml", {
                    encoding: "utf8"
                }
            ])

            expect(config.get("test1")).to.be.true;
            expect(config.get("test2")).to.equal(123);
            expect(config.get("test3")).to.equal("foo bar");
            expect(config.get("nested.A")).to.equal("a");
            expect(config.get("nested.B")).to.equal("b");
            expect(config.get("nested.C")).to.equal("c");
            expect(config.has("endpoint.publish.ngrok")).to.be.true;
        })

        it("should handle repeated values by keep first entry", async () => {
            readFsStub.returns("<config><test>A</test><test>B</test></config>")
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal("A");
        })

        it("should parse explicit integers as numbers", async () => {
            readFsStub.returns('<config><test type="int">123</test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal(123);
        })

        it("should parse explicit floats as numbers", async () => {
            readFsStub.returns('<config><test type="float">123.45</test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal(123.45);
        })

        it("should parse explicit bools as true/false", async () => {
            readFsStub.returns('<config><test1 type="bool">false</test1><test2 type="bool">TrUe</test2><test3 type="bool">adsfasd</test3></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test1")).to.be.false;
            expect(config.get("test2")).to.be.true;
            expect(config.get("test3")).to.be.false;
        })

        it("should parse explicit strings as strings", async () => {
            readFsStub.returns('<config><test type="string">123</test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal("123");
        });

        it("should auto detect integer numbers", async () => {
            readFsStub.returns('<config><test1>12345</test1><test2>123abc</test2></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test1")).to.equal(12345);
            expect(config.get("test2")).to.equal("123abc");
        })

        it("should auto detect float numbers", async () => {
            readFsStub.returns('<config><test1>123.45</test1><test2>123.</test2><test3>123.abc</test3></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test1")).to.equal(123.45);
            expect(config.get("test2")).to.equal(123.0);
            expect(config.get("test3")).to.equal("123.abc");
        })

        it("should not detect IP4 addresses as floats", async () => {
            readFsStub.returns('<config><test>192.168.1.77</test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal("192.168.1.77");
        })

        it("should auto detect booleans", async () => {
            readFsStub.returns('<config><test1>trUE</test1><test2>faLse</test2><test3>truefalse</test3></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test1")).to.be.true
            expect(config.get("test2")).to.be.false;
            expect(config.get("test3")).to.equal("truefalse");
        })

        it("should ignore non-type attributes", async () => {
            readFsStub.returns('<config><test1 foo="bar">Foo</test1><test2 a="b">35.7</test2></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test1")).to.equal("Foo");
            expect(config.get("test2")).to.equal(35.7);
        })

        it("should ignore non-type attributes on a config node", async () => {
            readFsStub.returns('<config><test foo="bar"><baz>Testing</baz></test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test.baz")).to.equal("Testing");
        })

        it("should handle self closed XML tags empty strings", async () => {
            readFsStub.returns('<config><foo/></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("foo")).to.equal("");
        })

        it("should handle empty XML tags as empty strings", async () => {
            readFsStub.returns('<config><test></test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal("");
        })

        it("should handle self closed XML tags empty strings", async () => {
            readFsStub.returns('<config><foo/></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("foo")).to.equal("");
        })

        it("should ignore XML comments", async () => {
            readFsStub.returns('<config><!-- TEST COMMENT //--><test type="number">543.12</test></config>');
            const config = await loadConfig("test/path/config.xml");

            expect(config.get("test")).to.equal(543.12);
        })

        it("should return an empty config for invalid XML", async () => {
            readFsStub.returns("INVALID");
            const config = await loadConfig("config.xml");

            expect(config).to.be.instanceOf(ConfigNode);
            for (const key in config) {
                expect(config[key]).to.be.instanceOf(Function);
            }
        })

        it("should return an empty config for missing file", async () => {
            existsFsStub.returns(false);
            const config = await loadConfig("config.xml");

            expect(config).to.be.instanceOf(ConfigNode);
            for (const key in config) {
                expect(config[key]).to.be.instanceOf(Function);
            }
        })
    })

    describe("saveConfig", () => {
        let writeFsStub: SinonStub;

        beforeEach(() => {
            writeFsStub = stub(fs, "writeFileSync");
        })

        afterEach(() => {
            writeFsStub.restore();
        })

        it("should save an empty config", async () => {
            const node = new ConfigNode();
            await saveConfig("/config.xml", node);

            expect(writeFsStub.callCount).to.equal(1);
            expect(writeFsStub.lastCall.args).to.eql([
                "/config.xml",
                "<config>\n</config>", {
                    encoding: "utf8"
                }
            ]);
        })

        it("should save immediate string values", async () => {
            const node = new ConfigNode();
            node.set("test1", "A");
            node.set("test2", "B");
            await saveConfig("/config2.xml", node);

            expect(writeFsStub.callCount).to.equal(1);
            expect(writeFsStub.lastCall.args).to.eql([
                "/config2.xml",
                "<config>\n    <test1>A</test1>\n    <test2>B</test2>\n</config>", {
                    encoding: "utf8"
                }
            ]);
        })

        it("should save immediate number values", async () => {
            const node = new ConfigNode();
            node.set("test1", 1);
            node.set("test2", 2.3);
            await saveConfig("/config2.xml", node);

            expect(writeFsStub.callCount).to.equal(1);
            expect(writeFsStub.lastCall.args).to.eql([
                "/config2.xml",
                '<config>\n    <test1>1</test1>\n    <test2>2.3</test2>\n</config>', {
                    encoding: "utf8"
                }
            ]);
        })

        it("should save nested values", async () => {
            const node = new ConfigNode();
            node.set("test1", 1);
            node.set("test2.a", false);
            node.set("test2.b", "foo");
            await saveConfig("/config3.xml", node);

            expect(writeFsStub.callCount).to.equal(1);
            expect(writeFsStub.lastCall.args).to.eql([
                "/config3.xml",
                '<config>\n' +
                '    <test1>1</test1>\n' +
                '    <test2>\n' +
                '        <a>false</a>\n' +
                '        <b>foo</b>\n' +
                '    </test2>\n' +
                '</config>', {
                    encoding: "utf8"
                }
            ]);
        })

        it("should save explicit string values", async () => {
            const node = new ConfigNode();
            node.set("test1", "1");
            node.set("test2", "23.45");
            node.set("test3", "true");
            node.set("test4", "false");
            await saveConfig("/test.xml", node);

            expect(writeFsStub.callCount).to.equal(1);
            expect(writeFsStub.lastCall.args).to.eql([
                "/test.xml",
                '<config>\n' +
                '    <test1 type="string">1</test1>\n' +
                '    <test2 type="string">23.45</test2>\n' +
                '    <test3 type="string">true</test3>\n' +
                '    <test4 type="string">false</test4>\n' +
                '</config>', {
                    encoding: "utf8"
                }
            ]);
        })
    })
})