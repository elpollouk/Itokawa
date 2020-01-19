import * as SerialPort from "serialport";

let message = "Hello World!";

console.log(message);

const port = new SerialPort('COM3', {
    baudRate: 115200
}, (err) => {
    console.log(err.message);
});
