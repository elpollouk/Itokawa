import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";

import * as express from "express";
import { requestGet } from "../../utils/testUtils";
import { registerRoutes } from "./configRouter";
import { Logger } from "../../utils/logger";
import { ConfigNode } from "../../utils/config";
import { application } from "../../application";

describe("configRouter", () => {
    let _app: express.Express;
    let _appConfig: ConfigNode;

    async function get() : Promise<any> {
        const response = await requestGet(_app, "/config", {
            sessionId: "mock_session_id"
        });

        return JSON.parse(response.text);
    }

    beforeEach(async () => {
        const router = express.Router();
        registerRoutes(router, new Logger("test"));
        _app = express();
        _app.use("/", router);

        _appConfig = new ConfigNode();
        stub(application, "config").value(_appConfig);
    })

    afterEach(() => {
        restore();
    })

    it("should return client config from application config", async () => {
        _appConfig.set("client.foo", "bar");
        _appConfig.set("client.baz", -1);

        const config = await get();

        expect(config).to.eql({ client: {
            foo: "bar",
            baz: -1
        }});
    })

    it("should return feature flags", async () => {
        stub(application.featureFlags, "getFlags").returns(["foo", "bar", "baz"].values());

        const config = await get();

        expect(config).to.eql({ features: [
            "foo",
            "bar",
            "baz"
        ]});
    })

    it("should return an empty config if no client config is set", async () => {
        _appConfig.set("foo", "bar");

        const config = await get();

        expect(config).to.eql({});
    })

    it("should return a 500 error on an exception", async () => {
        stub(application.featureFlags, "getFlags").throws(new Error("test error"));

        await expect(get()).to.be.eventually.rejectedWith(/500/);
    })
})