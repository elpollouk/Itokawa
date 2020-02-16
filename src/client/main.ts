import { Navigator } from "./pages/page";
import { IndexPageConstructor } from "./pages/index";
import { UpdatePageConstructor, UpdatePage } from "./pages/update";
import { Client } from "./client";
import { SystemDrawControl } from "./controls/systemDrawer";
import { TrainRosterConstructor } from "./pages/trainRoster";

window["main"] = function () {
    window["itokawa"] = new Client();

    //---------------------------------------------------------------------------------------//
    // System Drawer
    //---------------------------------------------------------------------------------------//
    const statusBar = document.getElementById("statusBar");
    new SystemDrawControl(statusBar);


    //---------------------------------------------------------------------------------------//
    // Page registry
    //---------------------------------------------------------------------------------------//
    Navigator.registerPage(IndexPageConstructor);
    Navigator.registerPage(UpdatePageConstructor);
    Navigator.registerPage(TrainRosterConstructor);

    const path = location.hash || IndexPageConstructor.path;
    Navigator.open(path);
}