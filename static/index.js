"use strict";
(function () {
    let socket = null;

    function openSocket(path) {
        const loc = window.location;
        let new_uri;
        if (loc.protocol === "https:") {
            new_uri = "wss:";
        } else {
            new_uri = "ws:";
        }
        new_uri += "//" + loc.host;
        if (path[0] !== "/") new_uri += loc.pathname
        new_uri += path;
        console.log(`Requestion WebSoccket connection to ${new_uri}`);
        return new WebSocket(new_uri);
    }

    function send(data) {
        if (!socket) return;
        socket.send(JSON.stringify(data));
    }

    window.setLocoSpeed = function (locoId, speed, reverse) {
        send({
            locoId: locoId,
            speed: speed,
            reverse: !!reverse
        });
    }

    window.main = function () {
        socket = openSocket("/control");
        socket.onerror = (err) => console.error(`WebSocket error: ${err}`);
        socket.onopen = () => console.log("WebSocket connection established");
        socket.onclose = () => console.log("WebSocket closed");
        socket.onmessage = (msg) => console.log(`WebSocket Message: ${msg}`);
    }
})();