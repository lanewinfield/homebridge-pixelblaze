import { PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';
import PixelblazeController from './lib/controller';
import PixelblazePlatform from './platform';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export default class PixelblazePlatformAccessory {
    private readonly platform;
    private readonly accessory;
    private device;
    private service;
    private refresh;
    private cctMode;
    private lastCommandTime;
    private commandCooldown;
    private state;
    constructor(platform: PixelblazePlatform, accessory: PlatformAccessory, device: PixelblazeController);
    setOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    setHue(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    setSaturation(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    setColorTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    setPattern(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    updateHomeKit(): void;
}
//# sourceMappingURL=platformAccessory.d.ts.map