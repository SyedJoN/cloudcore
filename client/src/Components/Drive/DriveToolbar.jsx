import { useNavigate } from "react-router-dom";
import { IconGrid, IconList, IconInfo } from "../Icons/Icons";
import { useAuth } from "../../Contexts/AuthContext";
import { getRouteConfig } from "../../../Utils/routeConfig";
import { useDevice } from "../../Contexts/DeviceContext";
import { useDropZone } from "../../Hooks/useDropZone";

/**
 * Breadcrumb button that can optionally accept dropped drive items.
 * Separate component because hooks can't be called inside .map().
 */
function CrumbButton({ disabled, onClick, onDrop, children, className = "" }) {
  const { isOver, dropProps } = useDropZone(onDrop, {
    enabled: !!onDrop && !disabled,
  });

  return (
    <button
      disabled={disabled}
      className={`gd-breadcrumb-item ${className} ${isOver ? "gd-drop-target" : ""}`}
      onClick={onClick}
      {...dropProps}
    >
      {children}
    </button>
  );
}

export default function DriveToolbar({
  dirContext,
  crumbs,
  setCrumbs,
  disabled,
  viewMode,
  onToggleView,
  toggleDetailsBar,
  onMove, // (ids: string[], targetFolderId: string | null, targetName: string) => void
}) {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { device } = useDevice();
  const {
    label: rootLabel,
    path: rootPath,
    flatBreadcrumb,
  } = getRouteConfig(dirContext);

  // Only My Drive supports moving via breadcrumb
  const canDrop = !!onMove && dirContext === "root";

  // At the root (no crumbs) the root button is the current location -> not a target
  const rootDrop =
    canDrop && crumbs.length > 0
      ? (ids) => onMove(ids, null, rootLabel)
      : undefined;

  const rootButton = (
    <CrumbButton
      disabled={disabled}
      className={loggedIn ? "" : "hide"}
      onClick={() => {
        setCrumbs([]);
        navigate(rootPath);
      }}
      onDrop={rootDrop}
    >
      {loggedIn ? rootLabel : ""}
    </CrumbButton>
  );

  return (
    <div className="gd-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      {!flatBreadcrumb ? (
        <div className="gd-breadcrumb">
          {rootButton}

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
                <CrumbButton
                  disabled={disabled}
                  onClick={() => {
                    navigate(`/directory/${crumb.id}`, {
                      state: { dirContext },
                    });
                  }}
                  onDrop={
                    canDrop && crumb.id
                      ? (ids) => onMove(ids, crumb.id, crumb.name)
                      : undefined
                  }
                >
                  {crumb.name}
                </CrumbButton>
              )}
            </span>
          ))}
        </div>
      ) : (
        <div className="gd-breadcrumb">
          {rootButton}
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
        <button
          onClick={toggleDetailsBar}
          className={`gd-icon-btn ${device === "mobile" ? "hidden!" : ""}`}
          title="Info"
        >
          <IconInfo />
        </button>
      </div>
    </div>
  );
}