import { useNavigate } from "react-router-dom";
import { IconGrid, IconList, IconInfo } from "../Icons/Icons";
import { useAuth } from "../../Contexts/AuthContext";
import { getRouteConfig } from "../../../Utils/routeConfig";
import { useDevice } from "../../Contexts/DeviceContext";
import { useDropZone } from "../../Hooks/useDropZone";
import ViewToggle from "./ViewToggle";

// In contexts mein folder ka asli root (My Drive / Shared with me) data se decide hota hai,
// chahe aap Home, search ya direct link se aaye hon. Google Drive bhi yahi karta hai.
const OWNER_CONTEXTS = ["home", "drive", "shared"];

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
  isHomeRoute,
  crumbs,
  setCrumbs,
  disabled,
  viewMode,
  onToggleView,
  toggleDetailsBar,
  rootKey, // "drive" | "shared" | null  (useDirectoryData se aata hai)
  onMove, // (ids: string[], targetFolderId: string | null, targetName: string) => void
}) {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { device } = useDevice();

  // Folder ke andar ho to uska asli root, warna route ka apna context
 let effectiveContext = dirContext;
if (OWNER_CONTEXTS.includes(dirContext) && rootKey && crumbs.length > 0) {
  effectiveContext = rootKey;
} else if (dirContext === "home") {
  effectiveContext = "drive";
}
const isResolving = dirContext === "home" && rootKey === undefined;
  const {
    label: rootLabel,
    path: rootPath,
    flatBreadcrumb,
  } = getRouteConfig(effectiveContext);

  // Only My Drive supports moving via breadcrumb
  const canDrop = !!onMove && effectiveContext === "drive";

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
{loggedIn && !isResolving ? rootLabel : undefined}
    </CrumbButton>
  );
  console.log("[toolbar]", { dirContext, rootKey, crumbs: crumbs.length });

  return (
    <div className="gd-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      {isHomeRoute ? (
        <div className="gd-breadcrumb">
          <span className="text-clip! hover:bg-transparent! cursor-default! gd-breadcrumb-item gd-breadcrumb-current">
            Welcome to Drive
          </span>
        </div>
      ) : !flatBreadcrumb ? (
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
                      state: { dirContext: effectiveContext },
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
      
<>
{!isHomeRoute &&
  <ViewToggle viewMode={viewMode} onToggleView={onToggleView}/>
}
    
          
        <button
          onClick={toggleDetailsBar}
          className={`gd-icon-btn ${device === "mobile" ? "hidden!" : ""}`}
          title="Info"
        >
          <IconInfo className="text-red-300" />
        </button>
        </>
    </div>
  );
}