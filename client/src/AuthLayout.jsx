import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./Contexts/AuthContext";
import CircularLoader from "./components/CircularLoader";
import { axiosWithCreds } from "../apis/axiosInstances";
import { useToast } from "./Contexts/ToastContext";
import AuthLoader from "./components/AuthLoader";
import GlobalLoader from "./components/GlobalLoader";

function Protected() {
  const { loggedIn, setloggedIn, refreshUser } = useAuth();
  const toast = useToast();

  useEffect(() => {
    const interceptor = axiosWithCreds.interceptors.response.use(
      (response) => response,
      (error) => {
        const location = window.location.pathname;

        const noToastRoutes = ["/privacy-policy", "/terms-of-service"];

        if (
          error?.response?.status === 401 &&
          error?.response?.data?.message === "Session expired or not found" &&
          !noToastRoutes.includes(location)
        ) {
          toast({ message: "No active session found", type: "error" });
          setloggedIn(false);
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axiosWithCreds.interceptors.response.eject(interceptor);
    };
  }, []);

  useEffect(() => {
    refreshUser();
  }, []);

  if (loggedIn === null) {
    return <GlobalLoader fullScreen />;
  }
  if (loggedIn === false) {
    return <Navigate to={"/login"} />;
  }

  return <Outlet/>
}

export default Protected;
