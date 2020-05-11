# OpenHAB IFTTT Gateway

Since july 2019 *myopenhab.org* does not allow to expose new items (https://www.openhab.org/docs/ecosystem/ifttt/), and we can not use IFTTT Openhab Service with new items.

So OpenHAB IFTTT Gateway provide a convenient and secure replacement to expose Openhab Items to IFTTT Webhooks (or other http client).

* Does not required to expose your Openhab server to internet (only this gateway need to be exposed)
* Does not require openhab-cloud (myopenhab.org or personnal openhab-cloud)
* Can be used for any http client (not limited to IFTTT)
* Expose only selected Items (with openhab TAG)
* Use only OpenHAB Rest API (internally)
* Very light, easy to understand and secure (writen in JS for NodeJS)


NOTE :
* Using it for IFTTT, you will need an IFTTT Account [IFTTT Webhooks](https://ifttt.com/maker_webhooks)
* For optimum security purpose : Please use HTTPS for exposing this gateway to internet (I personnlay use a reverse proxy with a DNS and a valid certificate)

## Installation / Configuration

This gateway has to be able to reach your openhab server and to be exposed on internet. You can install it on the side of your openhab server (thus if you use openhabian nodejs is already running)

At first you will need GIT / NodeJS and NPM

```
sudo apt update
sudo apt install git nodejs npm
```

1. Clone this project (where ever you want)
```
git clone https://github.com/ozirissp/openhab-ifttt-gateway.git
```

2. Configure

Open with a text editor the file *config.json* and change the few variables for your needs (be sure to **change the token value**)

```
{
    "server": {
        "port": 10000, // Gateway port
        "hostname": "0.0.0.0" // hostname for the server (default : 0.0.0.0 for all)
    },
    "openhab": {
        "uri": "http://openhab:8080/", // the URI for your openhabserver
        "tag": "IFTTT" // The tag to use to expose your items
    },
    "secret": "TheSecretTokenOfYourChoice" // The secret token for your gateway call
}
```

3. Install

Run the NPM install command :

```
npm install
```

4. Run

Start the gateway with :

```
node app.js
```

To start as a service see bellow : "Extra : Start as a service"


## Sending command to IFTTT (IFTTT Trigger)

**Note : The openhab-ifttt-gateway is not required for sending command to IFTTT**

First get your IFTTT Webhooks Key here [https://ifttt.com/maker_webhooks](https://ifttt.com/maker_webhooks) -> Documentation (when logged in)

For sending command to IFTTT you need a custom OpenHAB Item and Rule (recommanded)

*ifttt.items*
```
String   IFTTT_OUT   "IFTTT_OUT"
```

*ifttt.rules* (Be sure to change your **iftttKey**)
```
var String iftttKey = "change-me"

rule "Send IFTTT_OUT Command"
when
    Item IFTTT_OUT received command
then
    var iftttCommand = receivedCommand

    if(iftttCommand != "")    {
        logInfo("IFTTT_OUT", "IFTTT send command : "+iftttCommand)
        var response = sendHttpGetRequest("https://maker.ifttt.com/trigger/"+iftttCommand+"/with/key/"+iftttKey)        
        logInfo("IFTTT_OUT", "IFTTT sent response : "+response)
    }
end
```

In IFTTT configure your trigger :

1. Choose the service "Webhooks"
2. Receive a web request
3. Event Name - The event name of your choice


Then to send from openhab the event name (in rules or sitemaps) :

```
IFTTT_OUT.sendCommand("THE_EVENT_NAME_OF_YOUR_CHOICE")
```

## Receiving command from IFTTT (IFTTT Action)

This part require the gateway up and running !

Add the tag (default : IFTTT) to your items, which you want to exposed by the gateway

*ifttt.items*
```
String   IFTTT_IN   "IFTTT_IN"   ["IFTTT"]
```

With IFTTT configure your action :

1. Choose the service "Webhooks"
2. Make a web request
3. URL : 'http://yourgatewayexternalip:port/' - Method : 'POST' - Content Type : 'application/json' - Body : '{"token": "yourGwToken", "item": "IFTTT_IN", "command": "COMMAND"}'

Then you can make your openhab rules from IFTTT_IN :

```
rule "Receive IFTTT_IN Command"
when
    Item IFTTT_IN received command
then
    var iftttCommand = receivedCommand
    logInfo("IFTTT_IN", "IFTTT receive command : "+iftttCommand)
end
```

## Extra : Start as Service (using PM2)

With PM2 you can run the gateway as a service :

First install [PM2](https://www.npmjs.com/package/pm2)

`sudo npm install -g pm2`

And then add the gateway as a service with this commands

```
pm2 startup
pm2 start app.js
pm2 save
```