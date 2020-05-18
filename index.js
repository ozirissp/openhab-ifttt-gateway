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
const express = require('express');
const axios = require('axios');

// CONST
const OPENHAB_ITEMS_PATH = '/rest/items';

// VARIABLE
var ITEMS_CACHE = [];

// APP
const app = express();

app.use(express.json());

// Client for OpenHAB request
const openhabClient = axios.create({
    baseURL: OPENHAB_URI,
    headers: {
        get: {'Accept': 'application/json'},
        put: {'Content-Type': 'text/plain', 'Accept': 'application/json'},
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

app.get('/', function (req, res) {
    console.log('Refresh exposed items');
    refreshOpenhabExposedItems()
        .then(i => {
            res.sendStatus(200);
        })
        .catch(e => {
            console.error(e.message);
            res.sendStatus(500);
        });
});

const handleRequest = function (req, res, successFunction) {
    try {

        console.log(req.body);

        const token = req.body.token;
        const item = req.body.item;
        const value = req.body.value;

        if (TOKEN !== token) {
            console.warn(`Bad token : ${token}`);
            res.status(403).send('Bad token');
            return;
        }

        if (item === undefined) {
            console.warn(`Item is not defined`);
            res.status(400).send('Item is not defined');
            return;
        }

        if (value === undefined) {
            console.warn(`Value is not defined`);
            res.status(400).send('Value is not defined');
            return;
        }

        isItemExposed(item)
            .then(exposed => {
                if (!exposed) {
                    console.warn(`Item : ${item} not in ${ITEMS_CACHE}`);
                    res.status(400).send(`Item [${item}] not exposed`);
                } else {
                    successFunction(item, value)
                        .then(function (response) {
                            console.info(`Sucessful Item [${item}] update with value : '${value}'`);
                            res.sendStatus(200);
                        })
                        .catch(function (e) {
                            console.error(e.message);
                            res.sendStatus(500);
                        });
                }
            })
            .catch(e => {
                console.error(e.message);
                res.sendStatus(500);
            });

    } catch (e) {
        console.error(e.message);
        res.sendStatus(500);
    }
}


app.post('/', function (req, res) {

    const openHabSendCommand = function (item, value) {
        console.log(`${item}.sendCommand(${value})`);
        return openhabClient.post(`${OPENHAB_ITEMS_PATH}/${item}`, value);
    };

    handleRequest(req, res, openHabSendCommand);
});

app.put('/', function (req, res) {

    const openHabUpdateSate = function (item, value) {
        console.log(`${item}.postUpdate(${value})`);
        return openhabClient.put(`${OPENHAB_ITEMS_PATH}/${item}/state`, value);
    };

    handleRequest(req, res, openHabUpdateSate);
});

//START SERVER
app.listen(SERVER_PORT, SERVER_HOSTNAME, () => {
    console.log(`Server running on ${SERVER_HOSTNAME}:${SERVER_PORT}`);
});