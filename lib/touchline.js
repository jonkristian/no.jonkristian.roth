'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const thermostatParams = {
    thermostat_name: 'name',
    thermostat_mode: 'OPMode',
    weekprog_mode: 'WeekProg',
    target_temperature: 'SollTemp',
    measure_temperature: 'RaumTemp'
};

const thermostatModes = {
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

class TouchlineController {
    
    constructor(thermostat) {
        this.log = console.log;
        this.controller = Homey.ManagerSettings.get('controllerIP');
        this.thermostat = thermostat;
    }


    /**
     * Get controller data.
     * 
     * @param {mixed} request a string or array of queries.
     */
    async getControllerData(request) {
        const builder = new xml2js.Builder({headless: true, rootName: 'body'});
        const parser = new xml2js.Parser({explicitArray : false});
        let xmlRequest = {};
        let jsonResult = {};

        if ( typeof request == 'string' ) {
            xmlRequest = builder.buildObject({ item_list: { i: { n: request } } });
        } else {
            xmlRequest = builder.buildObject({ item_list: { i: request } });
        }

        const fetchQuery = await fetch('http://' + this.controller + '/cgi-bin/ILRReadValues.cgi', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: xmlRequest
        }).then(function (response) {
            return response.text();
        }).catch(function (error) {
            console.log('getControllerData: Could not fetch controller data.', error);
        });

        parser.parseString(fetchQuery, function (err, result) {
            jsonResult = result.body.item_list;
        });

        return jsonResult;
    }


    /**
     * Apply data to the controller.
     * 
     * @param {string} param The parameter to be changed.
     * @param {mixed} value The value to apply.
     */
    async applyControllerData(param, value) {
        const queryParams = 'G' + this.thermostat + '.' + param + '=' + value;

        const fetchQuery = await fetch('http://' + this.controller + '/cgi-bin/writeVal.cgi?'+queryParams, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'User-Agent': 'Mozilla/4.0 (Windows 8 6.2) Java/1.6.0_43'
            }
        }).then(function (response) {
            return response.text();
        }).catch(function (error) {
            console.log('applyControllerData: Could not apply data for thermostat', error);
        });

        return fetchQuery;
    }


    /**
     * Set target temperature for thermostat.
     * 
     * @param {int} value Target temperature value.
     */
    setTargetTemperature(value) {
        try {
            return this.applyControllerData('SollTemp', value);
        } catch (error) {
            this.log('Could not set target temperature for thermostat', error);
        }
    }


    /**
     * Rename thermostat.
     * 
     * @param {string} value New name of thermostat.
     */
    setThermostatName(value) {
        try {
            return this.applyControllerData('name', value);
        } catch (error) {
            this.log('Could not set thermostat name for thermostat', error);
        }
    }


    /**
     * Set thermostat mode.
     * 
     * @param {string} mode The mode to apply.
     */
    setThermostatMode(mode) {
        try {
            const modeKey = this.getKeyByValue(thermostatModes.OPMode, mode) ? 'OPMode' : 'WeekProg';
            const modeVal = this.getKeyByValue(thermostatModes[modeKey], mode);

            if ( 'OPMode' === modeKey ) {
                this.applyControllerData('WeekProg', 0);
                this.applyControllerData('OPMode', modeVal);
            } else {
                this.applyControllerData('OPMode', 0);
                this.applyControllerData('WeekProg', modeVal);
            }
        } catch (error) {
            this.log('Could not set thermostat mode for thermostat', error);
        }
    }


    /**
     * Refresh thermostat data.
     * 
     */
    async refreshThermostatData() {
        try {
            let items = [];
            let thermostats = [];

            for ( const [key, value] of Object.entries(thermostatParams) ) {
                items.push({
                    n: 'G' + this.thermostat + '.' + value
                })
            }

            const fetchQuery = await this.getControllerData(items);
            fetchQuery.i.forEach(function (el, i) {
                thermostats[el.n.split(".").pop()] = el.v
            });

            return thermostats;
        } catch (error) {
            this.log('refreshThermostatData: Could not parse data for thermostat', error);
        }
    }


    getKeyByValue(object, value) {
        try {
            return Object.keys(object).find(key => object[key] === value);
        } catch (error) {
            this.log('getKeyByValue: Could not return key by value', error);
        }
    }
}

module.exports = { TouchlineController };

