import { Outlet } from "react-router-dom";
import { useEffect } from "react";

import AuthLoader from "./AuthLoader";
import { useAuth } from "../Contexts/AuthContext";
import GlobalLoader from "./GlobalLoader";

const OptionalAuth = () => {
  const { loggedIn, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, []);

  if (loggedIn === null) {
    return <GlobalLoader fullScreen label="Loading homepage" />;
  }

  return <Outlet/>;
};

export default OptionalAuth;
