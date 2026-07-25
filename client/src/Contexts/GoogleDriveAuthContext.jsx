import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  logoutUser,
  logoutAll as logoutAllApi,
  googleDriveCheck,
} from "../../apis/authApi";
import { googleLogout } from "@react-oauth/google";

const GDriveContext = createContext(null);

export function GDriveAuthProvider({ children }) {
  const [isGoogleDrive, setIsGoogleDrive] = useState(false);

   const checkGoogleDriveAccess = useCallback(async () => {
  try {
    const res = await googleDriveCheck();
    setIsGoogleDrive(res.data.isAuthenticated);
  } catch (error) {
    if (error.response?.status !== 400) {
      console.error(error);
    }
    setIsGoogleDrive(false);
  }
}, []);

  const value = useMemo(
    () => ({
      isGoogleDrive,
      setIsGoogleDrive,
      checkGoogleDriveAccess,
    }),
    [isGoogleDrive, checkGoogleDriveAccess],
  );
  return (
    <GDriveContext.Provider
      value={value}
    >
      {children}
    </GDriveContext.Provider>
  );
}
export function useGDrive() {
  const context = useContext(GDriveContext);
    if (!context) {
    throw new Error("useGDrive must be used inside GDriveAuthProvider");
  }
  return context;
}

export default GDriveContext;
