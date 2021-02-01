'use strict';

const Homey = require('homey');
const Touchline = require('../../app');
const { TouchlineController } = require('../../lib/touchline');

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

class TouchlineDevice extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Touchline has been initialized');

    this.controller = new TouchlineController( this.getData().id );

		this.registerCapabilityListener('target_temperature', (value,opts) => {
      this.controller.setTargetTemperature(value*100);
    });
    
    this.registerCapabilityListener('thermostat_mode', (value,opts) => {
      this.controller.setThermostatMode(value);
    });

    let statusInterval = Homey.ManagerSettings.get('pollInterval') || 120;
    this.pollStatus(statusInterval);
  }


  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Thermostat has been added.');
  }


  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Touchline thermostat settings where changed');
  }


  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.controller.setThermostatName(name);
    this.log('Thermostat was renamed');
  }


  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    clearInterval(this.statusInterval);
    this.log('Thermostat has been deleted.');
  }


  async refreshThermostat() {
    try {
      const refresh = await this.controller.refreshThermostatData();

      if ( undefined != refresh.weekProg && 0 > refresh.WeekProg ) {
        this.setCapabilityValue('thermostat_mode', thermostatModes.WeekProg[refresh.WeekProg]);
      } else {
        this.setCapabilityValue('thermostat_mode', thermostatModes.OPMode[refresh.OPMode]);
      }

      this.setCapabilityValue('measure_temperature', refresh.RaumTemp/100);
      this.setCapabilityValue('target_temperature', refresh.SollTemp/100);
    } catch (error) {
      this.log('Failed to refresh thermostat: '+this.getData().id, error);
    }
  }


  pollStatus(interval) {
    clearInterval(this.statusInterval);
    this.statusInterval = setInterval(() => {
        try {
          this.refreshThermostat();

          if (!this.getAvailable()) {
            this.setAvailable();
          }
        } catch (error) {
          this.log(error);
          clearInterval(this.statusInterval);
          this.setUnavailable(Homey.__('unreachable'));
          setTimeout(() => {
            this.log("Timeout set");
          }, 1000 * interval);
        }
    }, 1000 * interval);
  }
}

module.exports = TouchlineDevice;
