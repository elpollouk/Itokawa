/*
    This is a dirty hack.
    chrome-launcher 1.0.0 was release as an ESM module, but the rest of this code can't be built
    as an ESM module itself due to the way the client imports json/html files and handles TS
    source code maps as a result of webpacking.

    Using a specific JS file to import chrome-launcher dynamically allows the TS loader to ignore
    the fact it's an ESM module and blindly accept whatever it returns (which we happen to know is
    exactly what we want).

    We do need to define an interface for the one type we want from chrome-launcher as that info
    doesn't exist as a run-time export and so can no longer be used at compile time.
*/
module.exports = {
    importLauncher: function () {
        return import("chrome-launcher");
    }
}
