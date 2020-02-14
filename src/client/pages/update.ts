import { Page, IPageConstructor, Navigator } from "./page";
import { CommandResponse } from "../../common/messages";
import { CommandConnection, ConnectionState } from "../commandConnection";
import { TtyControl } from "../controls/ttyControl";
import { LifeCycleRequest, RequestType, LifeCycleAction } from "../../common/messages";

export class UpdatePage extends Page {
    path: string = UpdatePageConstructor.path;
    content: HTMLElement;
    tty: TtyControl;
    readonly connection: CommandConnection;


    constructor () {
        super();
        this.connection = window["commandConnection"];
        this.content = this._buildUI();
    }

    _buildUI(): HTMLElement {
        const container = document.createElement("div");
        container.className = "updateTty";

        this.tty = new TtyControl(container);
        this.issueUpdateRequest();

        return container;
    }

    onMessage(err: Error, response?: CommandResponse) {
        if (err) {
            this.tty.stderr(err.message);
            return;
        }
        if (response.data) this.tty.stdout(response.data);
        if (response.error) this.tty.stderr(response.error);
    }

    issueUpdateRequest() {
        if (this.connection.state !== ConnectionState.Idle) {
            this.tty.stderr("Connection is busy. Try again later.");
            return;
        }
    
        this.tty.stdout("Requesting update...\n");
        this.tty.stdout(`Current git revision: ${this.connection.gitRevision}\n`);
    
        this.connection.request({
            type: RequestType.LifeCycle,
            action: LifeCycleAction.update
        } as LifeCycleRequest, (e, r) => this.onMessage(e, r));
    }
}

export const UpdatePageConstructor: IPageConstructor = {
    path: "update",
    create: () => new UpdatePage()
}