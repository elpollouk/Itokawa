import { CommandConnection, ConnectionState } from "../commandConnection";
import { CommandStationState } from "../../devices/commandStations/commandStation";
import * as protection from "./protectionControl";

export class ConnectionStatus {
    readonly element: HTMLElement;
    networkStatus: HTMLElement;
    commandStationStatus: HTMLElement;
    activityStatus: HTMLElement;

    constructor(readonly parent: HTMLElement, readonly connection: CommandConnection) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);

        connection.bind("state", (state: ConnectionState) => {
            switch (state) {
                case ConnectionState.Closed:
                    this.networkStatus.className = "led disconnected";
                    break;

                case ConnectionState.Opening:
                    this.networkStatus.className = "led connecting";
                    break;

                case ConnectionState.Idle:
                case ConnectionState.Busy:
                    this.networkStatus.className = "led connected";
                    break;

                default:
                    this.networkStatus.className = "led error";
                    break;
            }
        });

        connection.bind("deviceState", (state: CommandStationState) => {
            switch (state) {
                case CommandStationState.NOT_CONNECTED:
                case CommandStationState.UNINITIALISED:
                case CommandStationState.SHUTTING_DOWN:
                    this.commandStationStatus.className = "led disconnected";
                    break;

                case CommandStationState.INITIALISING:
                    this.commandStationStatus.className = "led connecting";
                    break;

                case CommandStationState.IDLE:
                case CommandStationState.BUSY:
                    this.commandStationStatus.className = "led connected";
                    break;

                default:
                    this.commandStationStatus.className = "led error";
                    break;
            }
        });

        let timeoutToken: NodeJS.Timeout;
        connection.bind("state", (state: ConnectionState) => {
            if (timeoutToken) clearTimeout(timeoutToken);
            switch (state) {
                case ConnectionState.Busy:
                    this.activityStatus.className = "led connected";
                    break;

                default:
                    timeoutToken = setTimeout(() => {
                        this.activityStatus.className = "led disconnected";
                        timeoutToken = null;
                    }, 250);
                    break;
            }
        });
    }

    _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "connectionStatus";

        function createLed() {
            const led = document.createElement("div");
            led.className = "led disconnected";
            container.appendChild(led);
            return led;
        }

        this.networkStatus = createLed();
        this.commandStationStatus = createLed();
        this.activityStatus = createLed();

        if (this.parent.childElementCount !== 0)
        {
            // If the system drawer doesn't contain any children, then don't bother enabling
            // interactions with it
            this.parent.onclick = () => {
                if (this.parent.classList.contains("expanded"))
                    this._closePanel();
                else
                    this._openPanel();
            }
        }

        return container;
    }

    _openPanel() {
        this.parent.classList.add("expanded");
        protection.enableProtection(() => this._closePanel());
    }

    _closePanel() {
        this.parent.classList.remove("expanded");
        protection.disableProtection();
    }
}