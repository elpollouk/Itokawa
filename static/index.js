"use strict";
(function () {
    let socket = null;
    let busy = false;

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

    function padZero(number, size) {
        size = size || 2;
        return ("00" + number).substr(-size);
    }

    function getTimeStamp() {
        const d = new Date()
        return `${d.getUTCFullYear()}-${padZero(d.getUTCMonth()+1)}-${padZero(d.getUTCDate())}T${padZero(d.getUTCHours())}:${padZero(d.getUTCMinutes())}:${padZero(d.getUTCSeconds())}.${padZero(d.getUTCMilliseconds(), 3)}Z`;
    }

    function send(data) {
        if (!socket) return;
        if (busy) return;
        busy = true;

        socket.send(JSON.stringify(data));
    }

    window.setLocoSpeed = function (locoId, speed, reverse) {
        send({
            type: 2,
            requestTime: getTimeStamp(),
            locoId: locoId,
            speed: speed,
            reverse: !!reverse
        });
    }

    window.requestShutdown = function () {
        send({
            type: 1,
            action: 1
        });
    }

    window.requestGitRev = function () {
        send({
            type: 1,
            action: 2
        });
    }

    window.main = function () {
        socket = openSocket("/control");
        socket.onerror = (err) => console.error(`WebSocket error: ${err}`);
        socket.onopen = () => console.log("WebSocket connection established");
        socket.onclose = () => console.log("WebSocket closed");
        socket.onmessage = (msg) => {
            console.log(`WebSocket Message: ${msg.data}`);
            busy = false;
        }
    }
})();