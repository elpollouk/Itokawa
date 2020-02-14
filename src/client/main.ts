import { CommandConnection, ConnectionState } from "./commandConnection";
import { ConnectionStatus } from "./controls/connectionStatus";
import { PublicUrlQrCode } from "./controls/publicUrlQrCode";
import * as promptControl from "./controls/promptControl";
import { LifeCycleRequest, RequestType, LifeCycleAction } from "../common/messages";

import { Navigator } from "./pages/page";
import { IndexPageConstructor } from "./pages/index";
import { UpdatePageConstructor } from "./pages/update";

(function () {
    let connection: CommandConnection = null;

    window["main"] = function () {
        connection = new CommandConnection("/control");
        window["commandConnection"] = connection;

        //---------------------------------------------------------------------------------------//
        // System Drawer
        //---------------------------------------------------------------------------------------//
        new PublicUrlQrCode(document.getElementById("qrcodeContainer"), connection);
        new ConnectionStatus(document.getElementById("statusBar"), connection);

        const globalControls = document.getElementById("globalControls");
        function createSystemButton(title: string, confirmation: string, onclick:()=>void) {
            const button = document.createElement("button");
            button.innerText = title;
            button.onclick = () => { promptControl.confirm(confirmation, onclick); }
            globalControls.appendChild(button);    
        }

        createSystemButton("Shutdown", "Are you sure you want to shutdown device?", () => {
            if (connection.state !== ConnectionState.Idle) return;
            connection.request({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.shutdown
            } as LifeCycleRequest);
        });

        createSystemButton("Restart", "Are you sure you want to restart device?", () => {
            if (connection.state !== ConnectionState.Idle) return;
            connection.request({
                type: RequestType.LifeCycle,
                action: LifeCycleAction.restart
            } as LifeCycleRequest);
        });

        createSystemButton("Update", "Are you sure you want to update device?", () => {
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


        //---------------------------------------------------------------------------------------//
        // Page registry
        //---------------------------------------------------------------------------------------//
        Navigator.registerPage(IndexPageConstructor);
        Navigator.registerPage(UpdatePageConstructor);
        Navigator.open(IndexPageConstructor.path);
    }

})();