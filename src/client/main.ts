import { Navigator } from "./pages/page";
import { IndexPageConstructor } from "./pages/index";
import { UpdatePageConstructor, UpdatePage } from "./pages/update";
import { client } from "./client";
import { SystemDrawControl } from "./controls/systemDrawer";
import { TrainRosterConstructor } from "./pages/trainRoster";
import { TrainEditConstructor } from "./pages/trainEditor";
import { AttributionsConstructor } from "./pages/attributions";
import { CvEditorConstructor } from "./pages/cvEditor";
import { LocoPanelConstructor } from "./pages/locoPanel";
import { FunctionSetupConstructor } from "./pages/functionSetup";
import { TestPageConstructor } from "./pages/test";

function openTestPage(message: string) {
    Navigator.open(TestPageConstructor.path, message);
}

window["main"] = function () {
    window["itokawa"] = client;
    window["openTestPage"] = openTestPage;

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
    Navigator.registerPage(FunctionSetupConstructor);
    Navigator.registerPage(LocoPanelConstructor);
    Navigator.registerPage(TestPageConstructor);

    Navigator.initalOpen();
}