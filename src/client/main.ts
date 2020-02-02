import * as messages from "../common/messages";
import { CommandConnection } from "./commandConnection";

(function () {
    let connection: CommandConnection = null;

    function padZero(number: number, size?: number) {
        size = size || 2;
        return ("00" + number).substr(-size);
    }

    function getTimeStamp() {
        const d = new Date()
        return `${d.getUTCFullYear()}-${padZero(d.getUTCMonth()+1)}-${padZero(d.getUTCDate())}T${padZero(d.getUTCHours())}:${padZero(d.getUTCMinutes())}:${padZero(d.getUTCSeconds())}.${padZero(d.getUTCMilliseconds(), 3)}Z`;
    }

    function timestamp(): string {
        const d = new Date()
        const year = d.getUTCFullYear();
        const month = padZero(d.getUTCMonth()+1);
        const date = padZero(d.getUTCDate());
        const hours = padZero(d.getUTCHours());
        const mins = padZero(d.getUTCMinutes());
        const seconds = padZero(d.getUTCSeconds());
        const ms = padZero(d.getUTCMilliseconds(), 3);
        return `${year}-${month}-${date}T${hours}:${mins}:${seconds}.${ms}Z`;
    }

    window["main"] = function () {
        connection = new CommandConnection("/control");
    }

    window["ping"] = function () {
        const pingRequest: messages.LifeCycleRequest = {
            type: messages.RequestType.LifeCycle,
            action: messages.LifeCycleAction.ping,
            requestTime: getTimeStamp()
        };

        connection.request(pingRequest, (err, response) => {
            if (err) console.error(err);
        });
    }

})();