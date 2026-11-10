import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { HardDrive, Package, Users, DiamondPlus, X } from "lucide-react";

import { IconLogin, IconLogout } from "./Icons/Icons";
import { fetchPortalUrl } from "../../apis/subscriptionApi";
import { useAuth } from "../Contexts/AuthContext";
import { useGDrive } from "../Contexts/GoogleDriveAuthContext";
import GoogleDriveBtn from "./ThirdPartyButtons/GoogleDrive";
import { UseAvatar } from "../Hooks/useAvatar";
import { useDevice } from "../Contexts/DeviceContext";

export default function UserAccountDrawerMobile({ open, onClose }) {
  const { user, loggedIn, logout, logoutAll } = useAuth();
  const { device } = useDevice();
  const { isGoogleDrive } = useGDrive();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isMainPage = pathname === "/";
  const isMongoId = /\/[a-fA-F0-9]{24}$/.test(pathname);

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return createPortal(
    <>
      {/* Scrim (same class as the left drawer) */}
      <div
        className={`gd-drawer-scrim ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`gd-drawer-right ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Account"
      >
        <div className="gd-drawer-right-head">
          <button
            className="gd-icon-btn"
            aria-label="Close account menu"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>

        {loggedIn ? (
          <>
            {/* Profile */}
            <div className="gd-user-menu-profile">
              <UseAvatar name={user.name} avatar={user.avatar} size={72} fontSize ={36}/>
              <div className="gd-user-menu-name">{user.name}</div>
              {user.email && (
                <div className="gd-user-menu-email">{user.email}</div>
              )}
              <span className="gd-user-menu-role-badge">{user.role}</span>
              <div className="flex items-center">
                <span className="gd-user-menu-plan-badge">{user.plan}</span>
                {user.plan !== "business" && (
                  <a
                    onClick={() => go(isMainPage ? "#pricing" : "/#pricing")}
                    className="btn hover:bg-blue-200 hover:text-blue-500 flex items-center rounded-md text-xs text-gray-500 capitalize font-medium py-2.5 cursor-pointer"
                  >
                    <DiamondPlus className="mr-1 text-blue-500" size={13} />
                    Upgrade
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="gd-user-menu-actions">
              {user.role !== "user" && (
                <button
                  className="gd-user-menu-item"
                  onClick={() => go("/users")}
                >
                  <Users size={20} /> Manage users
                </button>
              )}

              {(isMainPage || isMongoId) && (
                <button
                  className="gd-user-menu-item"
                  onClick={() => go("/drive")}
                >
                  <HardDrive size={20} /> My Drive
                </button>
              )}

              {user.plan !== "free" && (
                <button
                  className="gd-user-menu-item"
                  onClick={async () => {
                    onClose();
                    const url = await fetchPortalUrl();
                    window.location.href = url;
                  }}
                >
                  <Package size={20} /> My Plans
                </button>
              )}

              {!isGoogleDrive && device === "windows" && (
                <button className="gd-user-menu-gdrive flex">
                  <GoogleDriveBtn
                    width={20}
                    height={20}
                    classNames="p-0 gap-[14px]"
                  />
                </button>
              )}

              <div className="gd-user-menu-divider" />

              <button
                className="gd-user-menu-item danger"
                onClick={() => {
                  onClose();
                  logout();
                }}
              >
                <IconLogout size={20} /> Logout
              </button>
              <button
                className="gd-user-menu-item danger"
                onClick={() => {
                  onClose();
                  logoutAll();
                }}
              >
                <IconLogout size={20} /> Logout all devices
              </button>
            </div>
          </>
        ) : (
          <div className="gd-user-menu-actions">
            <button className="gd-user-menu-item" onClick={() => go("/login")}>
              <IconLogin size={20} /> Login
            </button>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}

