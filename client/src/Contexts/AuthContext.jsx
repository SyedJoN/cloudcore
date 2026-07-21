import { createContext, useContext, useState } from "react";
import { getCurrentUser } from "../../apis/userApi";
import { logoutUser, logoutAll as logoutAllApi } from "../../apis/authApi";
import { googleLogout } from "@react-oauth/google";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(null);
  const [user, setUser] = useState({});

  const logout = async () => {
    try {
      await logoutUser();
      setLoggedIn(false);
      setUser({});
      googleLogout();
    } catch (err) {
      setLoggedIn(true);
    }
  };

  const logoutAll = async () => {
    try {
      await logoutAllApi();
      setLoggedIn(false);
      setUser({});
    } catch (err) {
      setLoggedIn(true);
    }
  };

  const refreshUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
      setLoggedIn(true);
    } catch (err) {
      setLoggedIn(false);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loggedIn,
        setLoggedIn,
        refreshUser,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
