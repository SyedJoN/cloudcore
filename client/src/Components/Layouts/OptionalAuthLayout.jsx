import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { useAuth } from "../../Contexts/AuthContext";
import GlobalLoader from "../Loaders/GlobalLoader";

const OptionalAuth = () => {
  const { loggedIn, refreshUser } = useAuth();
  const { pathname } = useLocation();

  const labels = {
    "/main": "Homepage",
    "/privacy": "Privacy policy",
    "/terms": "Terms and conditions",
    "/cookies": "Cookies policy",
    "/licenses": "Licenses",
  };

  const label = labels[pathname] || "Page";

  useEffect(() => {
    refreshUser();
  }, []);

  if (loggedIn === null) {
    return <GlobalLoader fullScreen label={`Loading ${label}`} />;
  }

  return <Outlet />;
};

export default OptionalAuth;