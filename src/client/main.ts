import * as messages from "../common/messages";
import { CommandConnection } from "./commandConnection";

(function () {
    let connection: CommandConnection = null;

    window["main"] = function () {
        connection = new CommandConnection("/control");
        window["commandConnection"] = connection;
    }

    window["ping"] = function () {
        const pingRequest: messages.LifeCycleRequest = {
            type: messages.RequestType.LifeCycle,
            action: messages.LifeCycleAction.ping
        };

        connection.request(pingRequest, (err, response) => {
            if (err) console.error(err);
        });
    }

})();