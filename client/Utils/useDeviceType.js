import { useState, useEffect } from "react";

function detectDevice() {
  // SSR fallback.
  // This value is only used when window/navigator don't exist.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "windows";
  }

  const ua = navigator.userAgent.toLowerCase();

  // iPad can sometimes report itself as Macintosh.
  if (/ipad/.test(ua)) {
    return "tablet";
  }

  if (/iphone|ipod/.test(ua)) {
    return "ios";
  }

  if (/android/.test(ua)) {
    // Android tablets don't always contain "mobile".
    return /mobile/.test(ua) ? "android" : "tablet";
  }

  // Windows should be detected from the user agent
  if (/windows/.test(ua)) {
    return "windows";
  }

  // Other desktop operating systems.
  if (/macintosh|mac os x|linux|x11/.test(ua)) {
    return "windows";
  }

  // Fallback for unknown mobile browsers.
  if (/mobile|phone|opera mini|iemobile/.test(ua)) {
    return "mobile";
  }

  return "windows";
}
export function useDeviceType() {
  const [device, setDevice] = useState(detectDevice);

  useEffect(() => {
    // Re-check once after mounting in case the environment
    // differs from the initial client-side detection.
    const updateDevice = () => {
      const nextDevice = detectDevice();

      setDevice((currentDevice) =>
        currentDevice === nextDevice ? currentDevice : nextDevice
      );
    };

    updateDevice();
  }, []);

  return device;
}
