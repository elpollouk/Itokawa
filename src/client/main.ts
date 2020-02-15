import { CommandConnection, ConnectionState } from "./commandConnection";
import { ConnectionStatus } from "./controls/connectionStatus";
import { PublicUrlQrCode } from "./controls/publicUrlQrCode";
import * as promptControl from "./controls/promptControl";
import { LifeCycleRequest, RequestType, LifeCycleAction } from "../common/messages";

import { Navigator } from "./pages/page";
import { IndexPageConstructor } from "./pages/index";
import { UpdatePageConstructor, UpdatePage } from "./pages/update";
import { Client } from "./client";

(function () {
    let client: Client = null;

    window["main"] = function () {
        client = new Client();
        window["itokawa"] = client;

        //---------------------------------------------------------------------------------------//
        // System Drawer
        //---------------------------------------------------------------------------------------//
        const statusBar = document.getElementById("statusBar");
        new PublicUrlQrCode(document.getElementById("qrcodeContainer"));
        new ConnectionStatus(statusBar);

        const globalControls = document.getElementById("globalControls");
        function createSystemButton(title: string, confirmation: string, onclick:()=>void) {
            const button = document.createElement("button");
            button.innerText = title;
            button.onclick = () => { promptControl.confirm(confirmation, onclick); }
            globalControls.appendChild(button);    
        }

        createSystemButton("Shutdown", "Are you sure you want to shutdown device?", () => {
            if (client.connection.state !== ConnectionState.Idle) return;
            client.connection.request({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.shutdown
            } as LifeCycleRequest);
        });

        createSystemButton("Restart", "Are you sure you want to restart device?", () => {
            if (client.connection.state !== ConnectionState.Idle) return;
            client.connection.request({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.restart
            } as LifeCycleRequest);
        });

        createSystemButton("Update", "Are you sure you want to update device?", () => {
            if (!(Navigator.currentPage instanceof UpdatePage))
                Navigator.open(UpdatePageConstructor.path);
        });

        // TODO - Fix this to be diven by the full screen event
        let isFullcreen = false;
        const fullscreenButton = document.createElement("button");
        fullscreenButton.innerText = "Maximise";
        fullscreenButton.onclick = () => {
            if (isFullcreen) {
                document.exitFullscreen();
                fullscreenButton.innerText = "Maximise";
                isFullcreen = false;
            }
            else {
                document.body.requestFullscreen();
                fullscreenButton.innerText = "Minimise";
                isFullcreen = true;
            }
        };
        globalControls.appendChild(fullscreenButton);

        // Back button
        const backButton = document.createElement("button");
        backButton.className = "backButton";
        backButton.onclick = (ev: MouseEvent) => {
            Navigator.back();
            // We don't want the click to raise the containers event in this case
            ev.stopPropagation();
        };
        backButton.innerText = "<";
        statusBar.appendChild(backButton);


        //---------------------------------------------------------------------------------------//
        // Page registry
        //---------------------------------------------------------------------------------------//
        Navigator.registerPage(IndexPageConstructor);
        Navigator.registerPage(UpdatePageConstructor);
        Navigator.open(IndexPageConstructor.path);
    }

})();