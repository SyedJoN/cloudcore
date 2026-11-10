import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";

import { googleDriveCheck } from "../../apis/authApi";

const GDriveContext = createContext(null);

export function GDriveAuthProvider({ children }) {
  const [isGoogleDrive, setIsGoogleDrive] = useState(false);
  const [checkingGoogleDrive, setCheckingGoogleDrive] = useState(true);

  const checkGoogleDriveAccess = useCallback(async () => {
    setCheckingGoogleDrive(true);

    try {
      const res = await googleDriveCheck();

      console.log("DRIVE CHECK RESPONSE:", res.data);

      const authenticated = res.data?.isAuthenticated === true;

      setIsGoogleDrive(authenticated);

      return authenticated;
    } catch (error) {
      console.error("DRIVE CHECK ERROR:", error.response?.data || error);

      setIsGoogleDrive(false);
      return false;
    } finally {
      setCheckingGoogleDrive(false);
    }
  }, []);

  useEffect(() => {
    checkGoogleDriveAccess();
  }, [checkGoogleDriveAccess]);

  const value = useMemo(
    () => ({
      isGoogleDrive,
      setIsGoogleDrive,
      checkingGoogleDrive,
      checkGoogleDriveAccess,
    }),
    [isGoogleDrive, checkingGoogleDrive, checkGoogleDriveAccess],
  );

  return (
    <GDriveContext.Provider value={value}>{children}</GDriveContext.Provider>
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
