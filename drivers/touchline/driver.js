'use strict';

const Homey = require('homey');
const { TouchlineController } = require('../../lib/touchline');

class TouchlineDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.controller = new TouchlineController();
  }

  /**
   * Get number of thermostats and thermostat data.
   */
  async getThermostats() {
    try {
      let items = [];
      let thermostats = [];

      // Fetch number of thermostats and build array for our query.
      const numberOfItems = await this.controller.getControllerData('totalNumberOfDevices');
      for (let step = 0; step < numberOfItems.i.v; step++) {
        items.push({
          n: 'G' + step + '.name'
        })
      }

      // Fetch thermostat data and prepare data for homey.
      const fetchQuery = await this.controller.getControllerData(items);
      fetchQuery.i.forEach(function (el, i) {
        thermostats.push( {
            "data": { "id": i },
            "name": el.v
        });
      });

      return thermostats;

    } catch (error) {
      this.log('getThermostats: Could not parse thermostats.', error);
    }
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices( data, callback ) {
    const devices = await this.getThermostats();
    callback( null, devices );
  }
}

module.exports = TouchlineDriver;