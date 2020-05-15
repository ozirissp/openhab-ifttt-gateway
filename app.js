'use strict';

//################# CONFIGURATION #################
const config = require('./config.json');

const SERVER_PORT = config.server.port;
const SERVER_HOSTNAME = config.server.hostname;
const TOKEN = config.token;
const OPENHAB_URI = config.openhab.uri;
const OPENHAB_TAG = config.openhab.tag;
//##################################################

// IMPORT
const http = require('http');
const axios = require('axios');

// CONST
const OPENHAB_ITEMS_PATH = '/rest/items';

// VARIABLE
var ITEMS_CACHE = [];

// APP

// Client for OpenHAB request
const openhabClient = axios.create({
    baseURL: OPENHAB_URI,
    headers: {
        get: {'Accept': 'application/json'},
        post: {'Content-Type': 'text/plain', 'Accept': 'application/json'}
    }
});

//Fetch exposed items names from OpenHAB with desired TAG
const fetchOpenhabExposedItems = function () {
    const newExposedItems = [];

    console.log('Fetch exposed Items');

    return new Promise((resolve, error) => {
        openhabClient.get(`${OPENHAB_ITEMS_PATH}?tags=${OPENHAB_TAG}&recursive=false&fields=name`)
            .then(function (response) {
                const data = response.data;

                for (let itemIndex in data) {
                    const item = data[itemIndex];
                    const itemName = item.name;
                    newExposedItems.push(itemName);
                }
                resolve(newExposedItems);
            })
            .catch(error);
    });
};

// Refresh openhab exposed items
const refreshOpenhabExposedItems = function () {
    return new Promise((resolve, error) => {
        fetchOpenhabExposedItems()
            .then((i) => {
                ITEMS_CACHE = i;
                console.info('Exposed items : ' + i.join(", "))
                resolve(ITEMS_CACHE);
            })
            .catch(error);
    });
}

// Check if the item is exposed, refresh cache if not
const isItemExposed = function (item) {

    const itemExposed = ITEMS_CACHE.indexOf(item) >= 0;

    if (itemExposed) {
        return Promise.resolve(true);
    }

    console.log('Item not found in exposed items, refresh items ...');

    return new Promise((resolve, error) => {
        refreshOpenhabExposedItems()
            .then((newItems) => {
                resolve(newItems.indexOf(item) >= 0);
            })
            .catch(error);
    });
};

// Request handler
const server = http.createServer((req, res) => {

    console.log('New request');

    // Helper to send response
    const sendResponse = function (status, content) {
        res.statusCode = status;
        res.setHeader('Content-Type', 'text/plain');
        res.end(content);
    };

    if (req.method === 'GET') {
        refreshOpenhabExposedItems()
            .then(i => {
                sendResponse(200, 'Exposed items updated');
            })
            .catch(e => {
                console.error(e);
                sendResponse(500, 'Error to fetch exposed items');
            });
        return;
    }

    if (req.method !== 'POST') {
        sendResponse(404, 'Only GET/POST method available');
        return;
    }

    let data = [];

    req.on('data', chunk => {
        data.push(chunk);
    });

    req.on('end', () => {

        try {
            const content = JSON.parse(data);

            const token = content.token;

            if (TOKEN !== token) {
                console.warn(`Bad token : ${token}`);
                sendResponse(403, 'Token is invalid');
                return;
            }

            const item = content.item;
            const command = content.command;

            isItemExposed(item)
                .then(exposed => {
                    if (!exposed) {
                        console.warn(`Item : ${item} not in ${ITEMS_CACHE}`);
                        sendResponse(400, `Item [${item}] not exposed`);
                    } else {
                        if (command === undefined) {
                            console.warn(`Command : ${command} is not defined`);
                            sendResponse(400, `Missing command for item [${item}]`);
                            return;
                        }
                        //POST to OpenHAB
                        openhabClient.post(`${OPENHAB_ITEMS_PATH}/${item}`, command)
                            .then(function (response) {
                                console.info(`Sucessful Item [${item}] update with value : '${command}'`);
                                sendResponse(200, 'OK');
                            })
                            .catch(function (e) {
                                console.error(e.message);
                                sendResponse(500, `Error : ${e.message}`);
                            });
                    }
                })
                .catch(e => {
                    console.error(e.message);
                    sendResponse(500, `Error : ${e.message}`);
                });
        } catch (e) {
            console.error(e.message);
            sendResponse(500, `Error : ${e.message}`);
        }
    });
});

//START SERVER
server.listen(SERVER_PORT, SERVER_HOSTNAME, () => {
    console.log(`Server running on ${SERVER_HOSTNAME}:${SERVER_PORT}`);
});