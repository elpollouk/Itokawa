import { CommandResponse } from "../../common/messages";
import { CommandConnection, ConnectionState } from "../commandConnection";
import { ConnectionStatus } from "../controls/connectionStatus";
import { TtyControl } from "../controls/ttyControl";
import { LifeCycleRequest, RequestType, LifeCycleAction } from "../../common/messages";

let connection: CommandConnection = null;
let tty: TtyControl = null;

function onMessage(err: Error, response?: CommandResponse) {
    if (err) {
        tty.stderr(err.message);
        return;
    }

    if (response.data) tty.stdout(response.data);
    if (response.error) tty.stderr(response.error);
}

function issueUpdateRequest() {
    if (connection.state !== ConnectionState.Idle) {
        setTimeout(issueUpdateRequest, 100);
        return;
    }

    tty.stdout("Requesting update...")
    connection.request({
        type: RequestType.LifeCycle,
        action: LifeCycleAction.update
    } as LifeCycleRequest, onMessage);
}

export function updatePage() {
    connection = new CommandConnection("/control");
    window["commandConnection"] = connection;

    new ConnectionStatus(document.getElementById("statusBar"), connection);
    tty = new TtyControl(document.getElementById("updateTty"));

    setTimeout(issueUpdateRequest, 100);
}