import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import CircularLoader from "../Loaders/CircularLoader";
import GlobalLoader from "../Loaders/GlobalLoader";

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
