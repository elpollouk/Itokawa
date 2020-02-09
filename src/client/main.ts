import { CommandConnection } from "./commandConnection";
import { ConnectionStatus } from "./controls/connectionStatus";
import { TrainControl } from "./controls/trainControl";
import { RequestButton } from "./controls/requestButton";
import { PublicUrlQrCode } from "./controls/publicUrlQrCode";
import { LifeCycleRequest, RequestType, LifeCycleAction } from "../common/messages";
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
                         2732, [0, 32, 64, 96]);

        const globalControls = document.getElementById("globalControls");
        new RequestButton<LifeCycleRequest>(globalControls, connection, "Shutdown", () => {
            const yes = confirm("Are you sure you want to shutdown device?");
            if (!yes) return null;
            return {
                type: RequestType.LifeCycle,
                action: LifeCycleAction.shutdown
            };
        });

        new RequestButton<LifeCycleRequest>(globalControls, connection, "Restart", () => {
            const yes = confirm("Are you sure you want to restart device?");
            if (!yes) return null;
            return {
                type: RequestType.LifeCycle,
                action: LifeCycleAction.restart
            };
        });

        new PublicUrlQrCode(document.getElementById("qrcodeContainer"), connection);
    }

})();