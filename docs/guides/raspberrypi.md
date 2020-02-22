# Raspberry Pi Setup Guide

This guide aims to set up Itokawa on a fresh Raspberry Pi. Instructions for downloading and writing the SD card for the Raspberry Pi can be found on the [Raspbian Downloads](https://www.raspberrypi.org/downloads/raspbian/) page. This guide will work with the Raspbian Buster Lite download as no graphical user interface is required.

Although these instructions have been tested on a Raspberry Pi 3 Model B, they should in theory work for other models.

## Raspberry Pi Config

First time booting up, you can log in with the user name `pi` and the password `raspberry`. Once logged in, we want to make some configuration changes.

Launch the Raspberry Pi config app by entering the following and pressing enter:
```
sudo raspi-config
```

You will want to perform the following setup actions:
* Set a new user password.
* Set a memorable host name such as `itokawa`.
* Expand the file system to match the size of the SD card.
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
sudo shutdown -r now
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
You can run this command again to perform a manual update any time you wish and should be much quicker.

Finally, connect your command station (e.g. an eLink) to the Raspberry Pi and start Itokawa:
```
npm start
```

You should now be able to connect to your Raspberry Pi via the URL displayed in the outpu, e.g. [http://itokawa:8080](http://itokawa:8080). You can verify that the command station has been detected correctly by viewing the details in the about screen.

### Enable Auto-Start (optional)

_TO DO_

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
