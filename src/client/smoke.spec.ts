import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore } from "sinon";
import * as launcher from "chrome-launcher";
import * as chromeRemote from "chrome-remote-interface";
import * as express from "express";
import * as expressWs from "express-ws";
import { Server } from "http";
import * as setup from "../server/setup";
import { Database } from "../model/database";
import { application } from "../application";
import { NullCommandStation } from "../devices/commandStations/null";
import { timeout } from "../utils/promiseUtils";

const TEST_PORT = 18080;

describe("Client Smoke", () => {
    let chrome: launcher.LaunchedChrome;
    let client: chromeRemote.Client;
    let server: Server;

    async function startServer() {
        // Mock out application resources
        stub(application, "commandStation").value(new NullCommandStation());
        stub(application, "database").value(await Database.open(":memory:"));
        stub(application, "publicUrl").value(`http://127.0.0.1:${TEST_PORT}/`);
        stub(application, "gitrev").value("test_revision");

        return new Promise<void>(async (resolve, reject) => {
            try {
                const ews = expressWs(express());
                const app = ews.app;
                await setup.registerMiddleware(app);
                server = app.listen(TEST_PORT, "127.0.0.1", resolve);
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    async function stopServer() {
        return new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            })
        });
    }

    async function retry<T>(attempts: number, delaySeconds: number, action: ()=>Promise<T>): Promise<T> {
        while (true) {
            try {
                return await action();
            }
            catch (ex) {
                if (--attempts <= 0) {
                    throw ex;
                }
                console.log("Error occurred, retrying...");
                await timeout(delaySeconds);
            }
        }
    }

    async function silentClose(action: ()=>Promise<any>): Promise<void> {
        try {
            await action();
        }
        catch (ex) {
            //console.error(ex);
        }
    }

    async function openPage(path: string) {
        const result = await client.Page.navigate({
            url: `http://127.0.0.1:${TEST_PORT}${path}`
        })
        expect(result.errorText).to.be.undefined;
        expect(client.Page["loadEventFired"]).to.not.be.undefined;
        await client.Page["loadEventFired"]();
    }

    async function evaluate<T>(expression: string): Promise<T> {
        const result = await client.Runtime.evaluate({
            expression: expression
        });
        expect(result.exceptionDetails).to.be.undefined;
        return result.result.value;
    }


    before(async function() {
        this.timeout(30000);

        console.log("Starting server...");
        await startServer();

        // This step can take a few seconds on github actions
        console.log("Launching Chrome...");
        chrome = await launcher.launch({
            chromeFlags: [
                "--disable-gpu",
                "--headless"
            ]
        });

        // This often fails on github actions
        console.log("Connecting remote interface...");
        client = await retry(3, 1, () => chromeRemote({
            port: chrome.port
        }));

        console.log("Starting domains...");
        await Promise.all([
            client.Runtime.enable(),
            client.Page.enable()
        ]);
    })

    after(async () => {
        await silentClose(() => client.close());
        await silentClose(() => chrome.kill());
        await stopServer();
        restore();
    })


    //-------------------------------------------------------------------------------------------//
    // Tests
    //-------------------------------------------------------------------------------------------//

    it("should open root page as expected", async () => {
        await openPage("/");

        const title: string = await evaluate("document.title");
        expect(title).to.eql("Itokawa");

        // Check the websocket connection
        while (await evaluate<number>("itokawa.connection.state") != 1) {
            await timeout(0.1);
        }

        const device: string = await evaluate("itokawa.connection.deviceId");
        expect(device).to.equal(NullCommandStation.deviceId + " 1.0.0");
        const gitrev: string = await evaluate("itokawa.connection.gitRevision");
        expect(gitrev).to.equal("test_revision");
    }).timeout(10000).slow(5000)

    it("should return a 'not found' response", async () => {
        await openPage("/not_found");
        const content = await evaluate("document.body.innerText");

        expect(content).to.eql("Not Found");
    }).timeout(10000).slow(5000)
})