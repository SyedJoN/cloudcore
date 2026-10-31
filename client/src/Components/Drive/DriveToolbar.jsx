import { useNavigate } from "react-router-dom";
import { IconGrid, IconList, IconInfo } from "../Icons/Icons";
import { useAuth } from "../../Contexts/AuthContext";
import { getRouteConfig } from "../../../Utils/routeConfig"; 

export default function DriveToolbar({
  dirContext,
  crumbs,
  setCrumbs,
  disabled,
  viewMode,
  onToggleView,
  toggleDetailsBar,
}) {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();

  const { label: rootLabel, path: rootPath, flatBreadcrumb } = getRouteConfig(dirContext);

  return (
    <div className="gd-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      {!flatBreadcrumb ? (
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