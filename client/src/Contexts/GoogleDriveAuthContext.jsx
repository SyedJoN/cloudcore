import { createContext, useContext, useState } from "react";
import { getCurrentUser } from "../../apis/userApi";
import {
  logoutUser,
  logoutAll as logoutAllApi,
  googleDriveCheck,
} from "../../apis/authApi";
import { googleLogout } from "@react-oauth/google";

const GDriveContext = createContext(null);

export function GDriveAuthProvider({ children }) {
  const [isGoogleDrive, setIsGoogleDrive] = useState(false);

  const checkGoogleDriveAccess = async () => {
    try {
      const res = await googleDriveCheck();
      setIsGoogleDrive(res.data.isAuthenticated);
    } catch (error) {
      console.log("error", error.message);
      setIsGoogleDrive(false);
    }
  };

  return (
    <GDriveContext.Provider
      value={{
        isGoogleDrive,
        setIsGoogleDrive,
        checkGoogleDriveAccess,
      }}
    >
      {children}
    </GDriveContext.Provider>
  );
}
export function useGDrive() {
  return useContext(GDriveContext);
}

export default GDriveContext;
