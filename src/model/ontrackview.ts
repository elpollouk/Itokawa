import { LocoView } from "./locoview";

export class OnTrackView extends LocoView {
    static readonly VIEW_KEY = "On Track";

    constructor() {
        super(OnTrackView.VIEW_KEY);
    }
}
