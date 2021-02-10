'use strict';

const Homey = require('homey');
const { TouchlineController } = require('../../lib/touchline');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
class TouchlineDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.setAvailable();

    this.controller = new TouchlineController( this.getData().id );
    this.polling = true;

		this.addListener('poll', this.pollDevice);

		this.registerCapabilityListener('target_temperature', async (value,opts) => {
      await this.controller.applyControllerData('SollTemp', value*100).catch(error => this.log(error));
    });

    this.registerCapabilityListener('thermostat_mode', async (value,opts) => {
      if ( 'holiday' == value ) {
          await this.setCapabilityValue('onoff', false).catch(error => this.log(error));
      } else {
        if (this.getCapabilityValue('onoff') !== true) {
          await this.setCapabilityValue('onoff', true).catch(error => this.log(error));
        }
      }

      await this.controller.setThermostatMode(value).catch(error => this.log(error));
    });

    this.registerCapabilityListener('onoff', async (value,opts) => {
      if (value == false) {
        await this.controller.setThermostatMode('holiday').catch(error => this.log(error));
      } else {
        await this.controller.setThermostatMode('comfort').catch(error => this.log(error));
      }
    });

    // Enable device polling
    this.emit('poll');
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
    await this.controller.applyControllerData('name', name).catch(error => this.log(error));
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.polling = false;
    this.log('Thermostat has been deleted.');
  }

  /**
   * Poll for new thermostat data.
   * 
   */
  async pollDevice() {
    while (this.polling) {
      const params = this.prepareDeviceParams();
      await this.controller.getControllerData(params)
      .then(result => {
        if (null !== result) {
          const modes = this.controller.getModesMap();
          const data = [];
          result.i.forEach(function (el, i) {
              data[el.n.split(".").pop()] = el.v
          });
          if ( undefined != data.weekProg && 0 > data.WeekProg ) {
            this.setCapabilityValue('thermostat_mode', modes.WeekProg[data.WeekProg]).catch(err => this.log(err));
          } else {
            this.setCapabilityValue('thermostat_mode', modes.OPMode[data.OPMode]).catch(err => this.log(err));
          }
          this.setCapabilityValue('measure_temperature', data.RaumTemp/100).catch(err => this.log(err));
          this.setCapabilityValue('target_temperature', data.SollTemp/100).catch(err => this.log(err));
        }
      })
      .catch(error => {
        // Sometimes these thermostats doesn't report back, supressing errors.
        // this.log(error);
      });

      let pollInterval = Homey.ManagerSettings.get('pollInterval') || 120;
      await delay(pollInterval*1000);
    }
  }

  /**
   * Parameters to query controller.
   * 
   * @param {int} device Id of the thermostat.
   */
  prepareDeviceParams() {
    const device = this.getData().id;
    return [
      { n: 'G'+device+'.name' },
      { n: 'G'+device+'.OPMode' },
      { n: 'G'+device+'.WeekProg' },
      { n: 'G'+device+'.SollTemp' },
      { n: 'G'+device+'.RaumTemp' }
    ];
  }
}

module.exports = TouchlineDevice;
