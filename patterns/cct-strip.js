// CCT pattern for homebridge-pixelblaze (cctMode: true)
// G = neutral white base, R = warm tint, B = cool tint

export var hue = 0.5        // Temperature: 0=warm, 1=cool
export var saturation = 0.0 // Ignored for CCT
export var value = 1.0      // Target brightness

var currentBrightness = 0.0
var fadeDurationMs = 1000.0

export function hsvPickerColor(h, s, v) {
  hue = h
  saturation = s
  value = v
}

export function beforeRender(delta) {
  var step = delta / fadeDurationMs
  if (step > 1) step = 1

  if (currentBrightness < value) {
    currentBrightness = min(currentBrightness + step, value)
  } else if (currentBrightness > value) {
    currentBrightness = max(currentBrightness - step, value)
  }
}

export function render(index) {
  var t = hue
  var b = currentBrightness

  var warmAmt = (1.0 - t) * 0.5  // up to 50% warm tint
  var coolAmt = t * 0.5          // up to 50% cool tint

  rgb(warmAmt * b, b, coolAmt * b)
}
