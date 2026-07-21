import React from "react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getColor } from "../../utils/getProfileColor";
import { IconLogin, IconLogout, IconUsers } from "./Icons";
import { googleLogout } from "@react-oauth/google";
import { logoutAll, logoutUser } from "../../apis/authApi";
import { HardDrive, Package, Users, Diamond, DiamondPlus } from "lucide-react";
import { fetchPortalUrl } from "../../apis/subscriptionApi";
import { useAuth } from "../Contexts/AuthContext";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

function UserAccountBar() {
    const {user, setUser, loggedIn, setLoggedIn} = useAuth();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const [hasImgError, setHasImgError] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── 1. Close menu on outside click (ref-based, same as original) ──────────
  useEffect(() => {
    function handleOutsideClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── Avatar: photo → coloured initial fallback ─────────────────────────────
  const avatarEl =
    user.avatar && !hasImgError ? (
      <img
        src={user.avatar}
        alt={user.name}
        onError={() => setHasImgError(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
        }}
      />
    ) : (
      <span
        className="gd-avatar"
        style={{
          background: getColor(user.name),
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {user.name?.charAt(0)?.toUpperCase()}
      </span>
    );
  // ── Logout ─────────────────────────────────────────────────────────────
  async function handleLogout() {
    try {
      const res = await logoutUser();
      console.log("res", res);
      if (res.status === 200) {
        setLoggedIn(false);
        setUser({
          name: "",
          avatar: "",
          email: "",
          role: "",
        });
        navigate("/login");
      }
    } catch (err) {
      console.error("Logout error:", err.message);
    } finally {
      googleLogout();
      setShowUserMenu(false);
    }
  }

  async function handleLogoutAll() {
    try {
      const res = await logoutAll();
      if (res.status === 200) {
        setLoggedIn(false);
        setUser({
          name: "",
          avatar: "",
          email: "",
          role: "",
        });
        navigate("/login");
      }
    } catch (err) {
      console.error("Logout all error:", err.message);
    } finally {
      setShowUserMenu(false);
    }
  }

  return (
    <div
      className="gd-user-menu-container"
      ref={userMenuRef}
      style={{ position: "relative" }}
    >
      {!loggedIn ? (
        <button className="sign-in-btn" onClick={() => navigate("/login")}>
          Sign in
        </button>
      ) : (
        <div
          style={{ cursor: "pointer", lineHeight: 0 }}
          title="Account"
          onClick={() => setShowUserMenu((v) => !v)}
        >
          {avatarEl}
        </div>
      )}

      {showUserMenu && (
        <div
          className="gd-user-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            width: 280,
          }}
        >
          {loggedIn ? (
            <>
              {/* Profile info */}
              <div className="gd-user-menu-profile">
                {user.avatar && !hasImgError ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    className="gd-user-menu-avatar"
                    style={{ background: getColor(user.name) }}
                  >
                    {user.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}
                <div className="gd-user-menu-name">{user.name}</div>
                {user.email && (
                  <div className="gd-user-menu-email">{user.email}</div>
                )}
                <span className="gd-user-menu-role-badge">{user.role}</span>
                <div className="flex items-center">
                  <span className="gd-user-menu-plan-badge">{user.plan}</span>
                  {user.plan !== "business" && (
                    <a
                      href={
                        location.pathname.endsWith("/main")
                          ? "#pricing"
                          : "/main#pricing"
                      }
                      className="btn hover:bg-blue-200 hover:text-blue-500 flex items-center rounded-md text-xs text-gray-500 capitalize font-medium py-2.5 cursor-pointer"
                    >
                      <DiamondPlus className="mr-1 text-blue-500" size={13} />
                      Upgrade
                    </a>
                  )}
                </div>
              </div>

              <div className="gd-user-menu-actions">
                {/* Manage users — only for admins / non-default roles */}
                {user.role !== "user" && (
                  <button
                    className="gd-user-menu-item"
                    onClick={() => {
                      navigate("/users");
                      setShowUserMenu(false);
                    }}
                  >
                    <Users size={18} /> Manage users
                  </button>
                )}
                {window.location.pathname.endsWith("/main") && (
                  <button
                    className="gd-user-menu-item"
                    onClick={() => {
                      navigate("/");
                      setShowUserMenu(false);
                    }}
                  >
                    <HardDrive size={18} /> My Drive
                  </button>
                )}{" "}
                {user.plan !== "free" && (
                  <button
                    className="gd-user-menu-item"
                    onClick={async () => {
                      setShowUserMenu(false);

                      const url = await fetchPortalUrl();
                      window.location.href = url;
                    }}
                  >
                    <Package size={18} /> My Plans
                  </button>
                )}
                <div className="gd-user-menu-divider" />
                <button
                  className="gd-user-menu-item danger"
                  onClick={handleLogout}
                >
                  <IconLogout size={18} /> Logout
                </button>
                <button
                  className="gd-user-menu-item danger"
                  onClick={handleLogoutAll}
                >
                  <IconLogout size={18} /> Logout all devices
                </button>
              </div>
            </>
          ) : (
            <div className="gd-user-menu-actions">
              <button
                className="gd-user-menu-item"
                onClick={() => {
                  navigate("/login");
                  setShowUserMenu(false);
                }}
              >
                <IconLogin size={18} /> Login
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserAccountBar;
