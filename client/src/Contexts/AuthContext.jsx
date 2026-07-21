import { createContext, useContext, useState } from "react";
import { getCurrentUser } from "../../apis/userApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(null);
  const [user, setUser] = useState({});

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
      value={{ user, setUser, loggedIn, setLoggedIn, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
