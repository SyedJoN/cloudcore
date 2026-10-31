import { createContext, useContext, useEffect, useMemo } from "react";
import { useDeviceType } from "../../Utils/useDeviceType.js";

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const detectedOS = useDeviceType();

  // Device detection
  const device = useMemo(() => {
    if (["android", "ios", "tablet", "mobile"].includes(detectedOS)) {
      return "mobile";
    } else {
      return "windows";
    }
  }, [detectedOS]);


  return (
    <DeviceContext.Provider
      value={{
        device,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used inside AuthProvider");
  }
  return context;
}

export default DeviceContext;
