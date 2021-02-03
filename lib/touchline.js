'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

class TouchlineController {
    
    constructor(thermostat) {
        this.log = console.log;
        this.controller = Homey.ManagerSettings.get('controllerIP');
        this.thermostat = thermostat;
    }

    /**
     * Get controller data.
     * @param {mixed} request a string or array of queries.
     */
    async getControllerData(request) {
        const address = this.controller;
        
        const xml2js = require('xml2js');
        const builder = new xml2js.Builder({headless: true, rootName: 'body'});
        const parser = new xml2js.Parser({explicitArray : false});

        let xmlRequest;
        if ( typeof request == 'string' ) {
            xmlRequest = builder.buildObject({ item_list: { i: { n: request } } });
        } else {
            xmlRequest = builder.buildObject({ item_list: { i: request } });
        }

        return new Promise(function (resolve, reject) {
            fetch('http://' + address + '/cgi-bin/ILRReadValues.cgi', {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml' },
                body: xmlRequest
            })
            .then(res => res.text())
            .then(text => {
                parser.parseString(text, function (error, result) {
                    return resolve(result.body.item_list);
                });
            })
            .catch(error => {
                return reject(error);
            });
        });
    }

    /**
     * Apply data to the controller.
     * @param {string} param The parameter to be changed.
     * @param {mixed} value The value to apply.
     */
    async applyControllerData(param, value) {
        const queryParams = 'G' + this.thermostat + '.' + param + '=' + value;
        await fetch('http://' + this.controller + '/cgi-bin/writeVal.cgi?'+queryParams, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'User-Agent': 'Mozilla/4.0 (Windows 8 6.2) Java/1.6.0_43'
            }
        })
        .catch(error => {
            console.log(error);
        });
    }

    /**
     * Set thermostat mode.
     * @param {string} mode The mode to apply.
     */
    async setThermostatMode(mode) {
        const modes = this.getModesMap();
        const modeKey = this.getKeyByValue(modes.OPMode, mode) ? 'OPMode' : 'WeekProg';
        const modeVal = this.getKeyByValue(modes[modeKey], mode);

        if ( 'OPMode' === modeKey ) {
            await this.applyControllerData('WeekProg', 0).catch(error => this.log(error));
            await this.applyControllerData('OPMode', modeVal).catch(error => this.log(error));
        } else {
            await this.applyControllerData('OPMode', 0).catch(error => this.log(error));
            await this.applyControllerData('WeekProg', modeVal).catch(error => this.log(error));
        }
    }

    getKeyByValue(object, value) {
        try {
            return Object.keys(object).find(key => object[key] === value);
        } catch (error) {
            this.log('Could not find key by value.', error);
        }
    }

    getModesMap() {
        return {
            'OPMode': {
                0: 'comfort',
                1: 'night',
                2: 'holiday'
            },
            'WeekProg': {
                1: 'pro1',
                2: 'pro2',
                3: 'pro3'
            }
        };
    }
}

module.exports = { TouchlineController };

