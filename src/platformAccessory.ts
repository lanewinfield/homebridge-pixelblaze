import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';
import PixelblazeController from './lib/controller';
import CustomCharacteristic from './lib/patterns';
import PixelblazePlatform from './platform';

// CCT mode constants (mireds)
const CCT_MIN_MIREDS = 140;  // ~7100K (cool)
const CCT_MAX_MIREDS = 500;  // ~2000K (warm)

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export default class PixelblazePlatformAccessory {
  private service: Service;
  private refresh = 5.0;
  private cctMode: boolean;

  private state = {
    hue: 0,
    saturation: 0,
    brightness: 0,
    pattern: 0,
    colorTemp: 320,  // Default to neutral (~3100K)
  };

  constructor(
    private readonly platform: PixelblazePlatform,
    private readonly accessory: PlatformAccessory,
    private device: PixelblazeController,
  ) {
    this.cctMode = this.platform.config.cctMode !== false;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Electromage')
      .setCharacteristic(this.platform.Characteristic.Model, 'Pixelblaze');

    // Get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // Set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    // this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // Register handlers for the our characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this));

    if (this.cctMode) {
      // CCT mode: use ColorTemperature instead of Hue/Saturation
      this.platform.log.info('CCT mode enabled for', this.device.props.address || 'Pixelblaze');

      this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature)
        .setProps({
          minValue: CCT_MIN_MIREDS,
          maxValue: CCT_MAX_MIREDS,
        })
        .on('set', this.setColorTemperature.bind(this));
    } else {
      // RGB mode: use Hue/Saturation
      this.service
        .getCharacteristic(this.platform.Characteristic.Hue)
        .on('set', this.setHue.bind(this));

      this.service
        .getCharacteristic(this.platform.Characteristic.Saturation)
        .on('set', this.setSaturation.bind(this));
    }

    // Pull in the dynamically created Characteristic subclass.
    const LightPattern = CustomCharacteristic(this.platform.Characteristic).LightPattern;

    if (!this.service.getCharacteristic(LightPattern)) {
      this.service.addCharacteristic(LightPattern);
    }

    this.service.getCharacteristic(LightPattern)
      .on('set', this.setPattern.bind(this));

    // Check the Pixelblaze state to keep it in sync.
    setInterval(() => {
      this.device.reload();

      if (this.device.props) {
        this.state.brightness = parseFloat(this.device.props.brightness);
        this.updateHomeKit();

        if (this.device.props.programList) {
          // this.platform.log.debug('Total programs: ' + this.device.props.programList.length);

          this.service.getCharacteristic(LightPattern).props.maxValue = this.device.props.programList.length - 1;
        }

        if (this.device.props.vars) {

          if (this.device.props.vars.hue !== null) {
            this.state.hue = this.device.props.vars.hue as number;
          }

          if (this.device.props.vars.saturation !== null) {
            this.state.saturation = this.device.props.vars.saturation as number;
          }

        }
      }

    }, this.refresh * 1000);

    // Update the serial number asynchronously, as we may not have it upon accessory creation.
    const hasAccessoryInfo = setInterval(() => {

      if (this.device.props && this.device.props.name) {
        const serial = this.device.props.name.split('_')[1];

        this.platform.log.debug(`Found serial: ${serial} and firmware: ${this.device.props.ver}`);

        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Name, this.device.props.name)
          .setCharacteristic(this.platform.Characteristic.SerialNumber, serial)
          .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.device.props.ver);

        clearInterval(hasAccessoryInfo);
      }

    }, this.refresh * 1000);
  }

  // Handle "SET" requests from HomeKit
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.platform.log.debug('Set Characteristic On ->', value);
    this.state.brightness = value as boolean ? 1.0 : 0.0;

    if (this.cctMode) {
      // In CCT mode, control brightness via pattern's 'value' variable for fade support
      this.device.setCommand({brightness: 1.0});  // Keep global brightness at max
      this.device.setCommand({setVars: {value: this.state.brightness}});
    } else {
      this.device.setCommand({brightness: this.state.brightness});
    }

    // When powered on, set to the colorpicker / architectural mode as defined in config.
    if (value && this.platform.config.colorpicker) {
      this.device.setCommand({activeProgramId: this.platform.config.colorpicker});
    }

    this.updateHomeKit();
    callback(null);
  }

  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.state.brightness = (value as number) / 100;

    if (this.cctMode) {
      // In CCT mode, control brightness via pattern's 'value' variable for fade support
      this.device.setCommand({setVars: {value: this.state.brightness}});
    } else {
      this.device.setCommand({brightness: this.state.brightness});
    }

    this.platform.log.debug('Set Characteristic Brightness -> ', value);

    this.updateHomeKit();
    callback(null);
  }

  setHue(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.state.hue = Math.round(((value as number / 360) + Number.EPSILON) * 100) / 100;
    this.platform.log.debug('Set Characteristic Hue -> ', this.state.hue);
    this.device.setCommand({setVars: {hue: this.state.hue}});

    this.updateHomeKit();
    callback(null);
  }

  setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.state.saturation = Math.round(((value as number / 100) + Number.EPSILON) * 100) / 100;
    this.platform.log.debug('Set Characteristic Saturation -> ', this.state.saturation);
    this.device.setCommand({setVars: {saturation: this.state.saturation}});

    this.updateHomeKit();
    callback(null);
  }

  setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.state.colorTemp = value as number;

    // Map mireds to hue: 500 mireds (warm) -> 0, 140 mireds (cool) -> 1
    const hue = (CCT_MAX_MIREDS - this.state.colorTemp) / (CCT_MAX_MIREDS - CCT_MIN_MIREDS);
    this.state.hue = Math.round((hue + Number.EPSILON) * 100) / 100;

    this.platform.log.debug('Set Characteristic ColorTemperature ->', value, 'mireds, hue ->', this.state.hue);
    this.device.setCommand({setVars: {hue: this.state.hue}});

    this.updateHomeKit();
    callback(null);
  }

  setPattern(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.platform.log.debug('Set Characteristic Pattern -> ', value);
    this.device.setCommand({activeProgramId: this.device.props.programList[value as number]['id']});

    callback(null);
  }

  // Update HomeKit's state. Since Pixelblaze users can modify the state out of band with the WebUI or Firestorm.
  updateHomeKit() {

    this.service.updateCharacteristic(this.platform.Characteristic.On, (this.state.brightness > 0) as boolean);

    if (this.cctMode) {
      // Map hue back to mireds: hue 0 -> 500 mireds (warm), hue 1 -> 140 mireds (cool)
      const mireds = Math.round(CCT_MAX_MIREDS - (this.state.hue * (CCT_MAX_MIREDS - CCT_MIN_MIREDS)));
      this.service.updateCharacteristic(this.platform.Characteristic.ColorTemperature, mireds);
    } else {
      this.service.updateCharacteristic(this.platform.Characteristic.Hue, Math.round(this.state.hue * 360));
      this.service.updateCharacteristic(this.platform.Characteristic.Saturation, Math.round(this.state.saturation * 100));
    }
  }

}
