import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../Contexts/AuthContext";
import AuthLoader from "./AuthLoader";
import CircularLoader from "./CircularLoader";
import GlobalLoader from "./GlobalLoader";

const PublicOnlyRoute = () => {
  const { loggedIn, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, []);

  if (loggedIn === null) {
    return <GlobalLoader fullScreen />;
  }

  if (loggedIn === true) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
