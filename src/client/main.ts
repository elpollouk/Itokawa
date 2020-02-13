import { CommandConnection, ConnectionState } from "./commandConnection";
import { ConnectionStatus } from "./controls/connectionStatus";
import { TrainControl } from "./controls/trainControl";
import { RequestButton } from "./controls/requestButton";
import { PublicUrlQrCode } from "./controls/publicUrlQrCode";
import * as promptControl from "./controls/promptControl";
import { LifeCycleRequest, RequestType, LifeCycleAction, CommandRequest } from "../common/messages";
import { updatePage } from "./pages/update";

(function () {
    let connection: CommandConnection = null;

    window["updatePage"] = updatePage;
    window["main"] = function () {
        connection = new CommandConnection("/control");
        window["commandConnection"] = connection;

        new ConnectionStatus(document.getElementById("statusBar"), connection);

        const trainControls = document.getElementById("trainControls");
        new TrainControl(trainControls,
                         connection,
                         "Class 43 HST",
                         4305, [0, 32, 64, 96]);
        new TrainControl(trainControls,
                         connection,
                         "GWR 0-6-0",
                         2732, [0, 32, 48, 64]);
        new TrainControl(trainControls,
                         connection,
                         "LMS 2-6-4",
                         2328, [0, 32, 56, 80]);
        
        new RequestButton<CommandRequest>(document.getElementById("emergencyStop"), connection, "Emergency Stop", () => {
            return {
                type: RequestType.EmergencyStop
            };
        });

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
            window.location.href = "update";
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

        new PublicUrlQrCode(document.getElementById("qrcodeContainer"), connection);
    }

})();