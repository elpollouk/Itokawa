# Raspberry Pi Setup Guide

This guide aims to set up Itokawa on a fresh Raspberry Pi. Instructions for downloading and writing the SD card for the Raspberry Pi can be found on the [Raspbian Downloads](https://www.raspberrypi.org/downloads/raspbian/) page. This guide will work with the Raspbian Buster Lite download as no graphical user interface is required.

These instructions have been tested on the Raspberry Pi 3 Model B and Raspberry Pi 1 Model B. In theory, this guide should work for any Raspberry Pi, but older models will take _much_, _much_ longer to set up.

## Setup Time:

Raspberry Pi 3 Model B: ~30 minutes
Raspberry Pi 1 Model B+: ~2 hours (SQLite build takes majority of time)
Raspberry Pi 1 Model B: 8+ hours (SQLite build uses swap memory, requires 340mb of RAM)

## Raspberry Pi Config

First time booting up, you can log in with the user name `pi` and the password `raspberry`. Once logged in, we want to make some configuration changes.

Launch the Raspberry Pi config app by entering the following and pressing enter:
```
sudo raspi-config
```

You will want to perform the following setup actions:
* Set a new user password.
* Set a memorable host name such as `itokawa`.
* Enter your Wi-Fi network details if you want to connect to the network wirelessly.
* Enable SSH access if you want to be able to perform system admin tasks such as updating the OS remotely.

When you have finished configuring the Raspberry Pi, exit the software and select `Yes` to reboot. After the Raspberry Pi has rebooted, log back in with the details you just configured.

## Software Installation

### Update Base Installation

Before installing Itokawa itself, we need to update your Raspberry Pi's software to make sure we're on the latest available version and git + nodejs + npm are installed and up to date.

First update the Linux installation:
```
sudo apt update
sudo apt dist-upgrade -y
```

Install the software require to run Itokawa:
```
sudo apt install -y git nodejs npm
sudo npm install npm@latest -g
sudo reboot now
```

Once the Raspberry Pi has restarted, log in again with the user name and password you configured earlier.

### Clone and Build Itokawa

First fetch the latest release of Itokawa:
```
git clone https://github.com/elpollouk/Itokawa.git
cd Itokawa
```

Then we need to fetch the dependencies and build the code. This step will take a few minutes, so you have plenty of time to go and make a cup of tea.
```
npm run prod-update
```
You can run this command again to perform a manual update any time you wish and it should be much quicker after the first run.

Finally, connect your command station (e.g. an eLink) to the Raspberry Pi and start Itokawa:
```
npm start
```

You should now be able to connect to your Raspberry Pi via the URL displayed in the outpu, e.g. [http://itokawa:8080](http://itokawa:8080). You can verify that the command station has been detected correctly by viewing the details in the about screen.

### Enable Auto-Start (optional)

If you want Itokawa to start automatically when the Raspberry Pi boots, then you can use the init.d script that lives in `support/rc/itokawa`. For a dedicated Raspberry Pi, the easiest way to register the script is to edit `/etc/rc.local` using `nano`:

```
sudo nano /etc/rc.local
```

Add the following lines before the `exit` command at the end of the script:

```
echo Starting Itokawa...
/home/pi/Itokawa/support/rc/itokawa start
```

Press `Ctrl+X` to exit and select yes to saving the file.

You can now test you changes by rebooting the Raspberry Pi:

```
sudo reboot now
```

Once rebooted, you should be able to open the web page sucessfully without any further action. You can also check that the server is running by executing:

```
ps -ef | grep node
```

If you see `node dist/server/main.js` in the output, then Itokawa is probably up and running.

### Configure Port Number (optional)

If you would rather use a different port for the server, you can create a custom config file for Itokawa by doing the following:

```
nano ~/.itokawa/config.xml
```

Enter the following text (changing 8080 to the port you wish to use):

```
<config>
    <server>
        <port>8080</port>
    </server>
</config>
```
Press `Ctrl+X` to exit and select yes to saving the file.

Next time Itokawa starts, it will use the port number you specified in the config file.
