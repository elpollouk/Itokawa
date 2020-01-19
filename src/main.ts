import * as SerialPort from "serialport";

function Open(path: string): Promise<SerialPort> {
    return new Promise((resolve, reject) => {
        let port = new SerialPort(path, {
            baudRate: 115200
        }, (err) => {
            if (err == null) {
                resolve(port);
            }
            else {
                reject(err);
            }
        });
    });
}

function EnsureValidMessage(message: Buffer) {
    let checkSum = 0;
    for (let i = 0; i < message.length; i++) {
        checkSum ^= message[i];
    }
    if (checkSum != 0) throw new Error("Invalid checksum");
}

function ApplyChecksum(message: number[]) {
    let checkSum = 0;
    for (let i = 0; i < message.length - 1; i++)
    {
        checkSum ^= message[i];
    }
    message[message.length - 1] = checkSum;
}

let lastReceivedMessage: Buffer = null;
let messages = [
    [0x21, 0x24, 0x05],
    [0x3A, 0x36, 0x34, 0x4A, 0x4B, 0x44, 0x38, 0x39, 0x42, 0x53, 0x54, 0x39]
];

let handShakeSomplete = false;

function SendNextMessage(port: SerialPort)
{
    if (messages.length != 0)
    {
        let message = messages.shift();
        port.write(message);
        return;
    }
    else if (handShakeSomplete)
    {
        return;
    }

    if (lastReceivedMessage.length != 7) throw new Error("Not enough data received");
    if (lastReceivedMessage[0] != 0x35) throw new Error("Unexpected message received");
    EnsureValidMessage(lastReceivedMessage);

    console.log("Received valid handshake request");

    let response: number[] = [ 0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ];
    for (let i = 1; i < 6; i++)
    {
        response[i] = (lastReceivedMessage[i] + 0x39) & 0xFF;
    }
    ApplyChecksum(response);

    console.log(`Sending response: ${response}`);
    port.write(response);

    handShakeSomplete = true;

    messages.push([0x21, 0x21, 0x00]);
}

async function main()
{
    console.log("Initialising...");
    
    let ports = await SerialPort.list();

    console.log(`Opening port ${ports[0].path}...`);
    
    let port = await Open(ports[0].path);
    port.on('data', (data) => {
        console.log('Data:', data);
        lastReceivedMessage = data;
        SendNextMessage(port);
    });

    console.log("Opened port");

    SendNextMessage(port);
} 


main().then(() => {
    console.log("Done.");
});