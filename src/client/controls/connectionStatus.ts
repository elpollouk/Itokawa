import { CommandConnection, ConnectionState } from "../commandConnection";
import { CommandStationState } from "../../devices/commandStations/commandStation";

export class ConnectionStatus {
    readonly element: HTMLElement;
    networkStatus: HTMLElement;
    commandStationStatus: HTMLElement;

    constructor(readonly parent: HTMLElement, readonly connection: CommandConnection) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);

        connection.onStateChanged = (state) => {
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
        };

        connection.onDeviceStateChanged = (state) => {
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
        };
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

        return container;
    }
}