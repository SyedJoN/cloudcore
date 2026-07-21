import { useNavigate } from "react-router-dom";
import { IconGrid, IconList, IconInfo } from "./Icons";
import { useAuth } from "../Contexts/AuthContext";

export default function DriveToolbar({
  dirId,
  dirContext,
  crumbs,
  setCrumbs,
  isTrashRoute,
  breadcrumbs,
  setBreadcrumbs,
  disabled,
  viewMode,
  onToggleView,
  filteredDirs,
  toggleDetailsBar,
}) {
  const navigate = useNavigate();
  console.log("dirContext", dirContext, "isTrashRoute", isTrashRoute);
const {loggedIn} = useAuth();
  const rootLabel =
    dirContext === "trash"
      ? "Trash"
      : dirContext === "shared"
        ? "Shared with me"
        : dirContext === "home"
          ? "Home"
          : "My Drive";
  const rootPath =
    dirContext === "trash"
      ? "/trash"
      : dirContext === "shared"
        ? "/shared"
        : dirContext === "home"
          ? "/home"
          : "/";

  return (
    <div className="gd-toolbar bg-[#ffffff] dark:bg-[#131314]">
      {dirContext !== "trash" && dirContext !== "shared" ? (
        <div className="gd-breadcrumb bg-[#ffffff] dark:bg-[#131314]">
          <button
            disabled={disabled}
            className={`${loggedIn ? "gd-breadcrumb-item" : "hide"}`}
            onClick={() => {
              setCrumbs([]);
              navigate(rootPath);
            }}
          >
            {loggedIn ? rootLabel : ""}
          </button>

          {crumbs.map((crumb, i) => (
            <span
              key={crumb.id ?? i}
              style={{ display: "flex", alignItems: "center" }}
            >
              <span className="gd-breadcrumb-sep">
                {!loggedIn
                  ? crumbs.length > 1 && i > 0
                    ? "›"
                    : ""
                  : Object.keys(crumb).length > 0
                    ? "›"
                    : ""}
              </span>
              {i === crumbs.length - 1 ? (
                <span className="gd-breadcrumb-item gd-breadcrumb-current">
                  {crumb.name}
                </span>
              ) : (
                <button
                  className="gd-breadcrumb-item"
                  disabled={disabled}
                  onClick={() => {
                    navigate(`/directory/${crumb.id}`, {
                      state: { dirContext },
                    });
                  }}
                >
                  {crumb.name}
                </button>
              )}
            </span>
          ))}

     
        </div>
      ) : (
        <div className="gd-breadcrumb">
          <button
            disabled={disabled}
            className={`${loggedIn ? "gd-breadcrumb-item" : "hide"}`}
            onClick={() => {
              setCrumbs([]);
              navigate(rootPath);
            }}
          >
            {loggedIn ? rootLabel : ""}
          </button>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span className="gd-breadcrumb-sep">
              {Object.keys(crumbs[0] ?? []).length === 0 ? "" : "›"}
            </span>
            <button className="gd-breadcrumb-item" disabled={disabled}>
              {crumbs[crumbs.length - 1]?.name ?? ""}
            </button>
          </span>
        </div>
      )}
      <div className="gd-toolbar-actions">
        <button
          className="gd-icon-btn"
          title={viewMode === "grid" ? "List view" : "Grid view"}
          onClick={onToggleView}
        >
          {viewMode === "grid" ? <IconList /> : <IconGrid />}
        </button>
        <button onClick={toggleDetailsBar} className="gd-icon-btn" title="Info">
          <IconInfo />
        </button>
      </div>
    </div>
  );
}
