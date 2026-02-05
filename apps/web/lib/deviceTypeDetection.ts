import type { DeviceType } from "../types";

const USB_BRANDS = ["shure", "rode", "blue", "samson", "hyperx", "elgato", "audio-technica"];

export const detectDeviceTypeFromLabel = (label?: string | null): DeviceType => {
  const source = (label ?? "").toLowerCase();
  if (!source.trim()) return "unknown";

  if (/(bluetooth|airpods|headset)/i.test(source)) return "bluetooth";
  if (/(realtek|microphone array|internal|built-in)/i.test(source)) return "built_in";
  if (source.includes("usb") || USB_BRANDS.some((brand) => source.includes(brand))) return "usb_mic";

  return "unknown";
};
