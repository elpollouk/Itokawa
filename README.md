# Itokawa DCC Server

[Node.js](https://nodejs.org/) based [DCC server](https://www.nmra.org/dcc-working-group) for model trains and railways.

Try an online demo built from the code in this repo [here](https://elpollouk.github.io/Itokawa/?demo). The demo mocks the connection to the control server but should provide a relevant example of the user interface.

## Quick-start Guide

* Install [Node.js](https://nodejs.org/en/download/)
* Install [Git](https://git-scm.com/downloads)
* Open a command prompt on your PC in the location you want to install Itokawa to (e.g. `C:\Projects`).
* Run the following commands:
```
git clone https://github.com/elpollouk/Itokawa.git
cd Itokawa
npm run prod-update
npm start
```

You should then be able to connect to the URL listed in the output using your web browser. If you have a supported command station connected to your PC, you should see a couple of green lights on the app status bar in your web browser.

Expanding the status bar by clicking on it and then clicking `About` should provide you details of the software and the command station.

You can update to the latest code at any time by running `npm run prod-update` again or by clicking `Update` in the `Server` menu within the app.

You can launch Itokawa again by running `npm start` in the Itokawa installation directory.

## Tested Command Stations
 * [Hornby eLink 1.07 (R8312)](https://www.hornby.com/uk-en/elink-and-railmaster-combination-pack.html)
 
## Tested Web Browsers
* [New Microsoft Edge](https://www.microsoft.com/en-us/edge)
* [Google Chrome](https://www.google.co.uk/chrome/index.html)
* Google Chrome for Android

## Dedicated Setup Guides
* [Raspberry Pi](https://github.com/elpollouk/Itokawa/wiki/Raspberry-Pi-Setup-Guide)

## Further Reading
* [Config XML Reference](https://github.com/elpollouk/Itokawa/wiki/Config-XML)
