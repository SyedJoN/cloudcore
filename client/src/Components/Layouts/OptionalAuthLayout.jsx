import { Outlet } from "react-router-dom";
import { useEffect } from "react";

import { useAuth } from "../../Contexts/AuthContext";
import GlobalLoader from "../Loaders/GlobalLoader";

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
