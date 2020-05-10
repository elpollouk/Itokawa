import { Navigator } from "./pages/page";
import { IndexPageConstructor } from "./pages/index";
import { UpdatePageConstructor, UpdatePage } from "./pages/update";
import { client } from "./client";
import { SystemDrawControl } from "./controls/systemDrawer";
import { TrainRosterConstructor } from "./pages/trainRoster";
import { TrainEditConstructor } from "./pages/trainEditor";
import { AttributionsConstructor } from "./pages/attributions";
import { CvEditorConstructor } from "./pages/cvEditor";
import { FunctionSetuprConstructor } from "./pages/functionSetup";
import { LocoPanelConstructor } from "./pages/locoPanel";
import { FunctionSetup2Constructor } from "./pages/functionSetup2";

window["main"] = function () {
    window["itokawa"] = client;

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
    Navigator.registerPage(TrainEditConstructor);
    Navigator.registerPage(AttributionsConstructor);
    Navigator.registerPage(CvEditorConstructor);
    Navigator.registerPage(FunctionSetuprConstructor);
    Navigator.registerPage(FunctionSetup2Constructor);
    Navigator.registerPage(LocoPanelConstructor);

    Navigator.initalOpen();
}