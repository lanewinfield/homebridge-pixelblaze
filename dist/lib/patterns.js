"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
function CustomCharacteristic(Characteristic) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = {};
    c.LightPattern = function () {
        Characteristic.call(this, 'LightPattern', c.LightPattern.UUID);
        this.setProps({
            format: "uint8" /* UINT8 */,
            perms: ["pr" /* PAIRED_READ */, "pw" /* PAIRED_WRITE */],
            minStep: 1,
            minValue: 0,
        });
        this.value = this.getDefaultValue();
    };
    c.LightPattern.UUID = '0EF49D24-1C87-4ACE-AD74-5832A7E03931';
    util_1.inherits(c.LightPattern, Characteristic);
    return c;
}
exports.default = CustomCharacteristic;
//# sourceMappingURL=patterns.js.map