# Itokawa DCC Server

[Node.js](https://nodejs.org/) based [DCC server](https://www.nmra.org/dcc-working-group) for model trains and railways.

## Quick-start Guide

* Install [Node.js](https://nodejs.org/en/download/)
* Install [Git](https://git-scm.com/downloads)
* Create a new directory on your PC and open a command prompt in the new directory.
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

## Tested Command Stations
 * [Hornby eLink 1.07 (R8312)](https://www.hornby.com/uk-en/elink-and-railmaster-combination-pack.html)
 
## Tested Web Browsers
* [New Microsoft Edge](https://www.microsoft.com/en-us/edge)
* [Google Chrome](https://www.google.co.uk/chrome/index.html)
* Google Chrome for Android

## Dedicated Setup Guides
* [Raspberry Pi](https://github.com/elpollouk/Itokawa/blob/master/docs/guides/raspberrypi.md)
