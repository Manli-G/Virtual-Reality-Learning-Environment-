# VRLE (Node.js/Socket.io/WebRTC/WebVR)

My machine:
MacOS version 10.14.6
Node version  v12.18.1

### Install Node.js 

Setup runtime environment  Node.js

#### Installation

#### 1.Open the terminal and type “brew update”
this updates home-brew with a list of the latest version of Node.

#### 2.Type “brew install node” 
Install it Under the file directory you wanna set, home-brew has to download some files and install them.

#### 3.Type”npm install express” to install express module
Install the other module follow the same pattern with “npm install ‘moudule_name’”, in my case the dependancies requires are ‘url’,’body-parser’,’express-session’,’http’,’https’,’socket.io’ etc, and those are written in the package.json file as well which can help check it. even though forget install it, it will remain you which module you didn’t install yet when you runing the server.

#### 4. Running it by type”node server.js”
If it running successful, the terminal also will showing the localhost 8002, open the browser enter the localhost:8002, it will open the project.

* To generate a self-signed certificate, run the following in your shell:
openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
rm csr.pem

### Install Coturn

Coturn is a free open source implementation of STUN and STURN server

#### Installation

#### 1.Open up your Terminal,run:
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)" < /dev/null 2> /dev/null 

#### 2. Install coturn using brew:
brew install coturn

### Configuration

#### 1. Generate a certificate

sudo openssl req -x509 -newkey rsa:2048 -keyout /opt/turnserver/turn_server_pkey.pem -out /opt/turnserver/turn_server_cert.pem -days 99999 -nodes

#### 2. Configure turnserver.config

listening-port(default 3478)
listening-ip(NIC teaming's IP address)
External-ip(external IP address)
long-term credential(configure user name and password)

#### 3. Start Coturn

execution turnserver -c turnserver.conf

#### 4.Test the STUN/TURN service by link https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

### Install Ngrok
