import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { getRouteConfig } from "../../../Utils/routeConfig";
import MobileContextMenu from "./MobileContextMenu"; // adjust path

/* ------------------------------ icons ------------------------------ */
const Svg = ({ children }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const IconBack = () => (
  <Svg>
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </Svg>
);
const IconSearch = () => (
  <Svg>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </Svg>
);
const IconMore = () => (
  <Svg>
    <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
  </Svg>
);

export default function DriveToolbarMobile({
  dirId,
  dirContext,
  crumbs = [],
  setCrumbs,
  disabled,
  onSearch,
  currentDir,
  onContextMenu,
  menuProps = {},
}) {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const { label: rootLabel, path: rootPath } = getRouteConfig(dirContext);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const validCrumbs = crumbs.filter((c) => c && Object.keys(c).length > 0);
  const current = validCrumbs[validCrumbs.length - 1];
  const parent = validCrumbs[validCrumbs.length - 2];

  const title = current?.name ?? (loggedIn ? rootLabel : "");
  const canGoBack = loggedIn ? validCrumbs.length > 0 : !!parent;

  const itemId = dirId;

  // Prefer the full directory object; fall back to the crumb (limited info,
  // so permission-gated actions will show as disabled)
  const menuItem =
    currentDir ??
    (current
      ? { _id: current.id, name: current.name, isDirectory: true }
      : null);

  const handleBack = () => {
    if (disabled || !canGoBack) return;
    if (parent) {
      navigate(`/directory/${parent.id}`, { state: { dirContext } });
    } else {
      setCrumbs([]);
      navigate(rootPath);
    }
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    onSearch?.("");
  };

  const submitSearch = (e) => {
    e.preventDefault();
    e.currentTarget.querySelector("input")?.blur(); // dismiss keyboard
  };

  // leaving/entering a folder resets the search UI
  useEffect(() => {
    setSearching(false);
    setQuery("");
  }, [current?.id]);

  /* Search mode: back arrow closes search, input fills the bar */
  if (searching) {
    return (
      <div
        className="gd-toolbar-mobile"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="gd-icon-btn"
          aria-label="Close search"
          onClick={closeSearch}
        >
          <IconBack />
        </button>
        <form
          className="gd-toolbar-search"
          onSubmit={submitSearch}
          role="search"
        >
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch?.(e.target.value); // live filter
            }}
            placeholder={`Search in ${title || "Drive"}`}
            aria-label="Search"
            enterKeyHint="search"
          />
        </form>
      </div>
    );
  }

  return (
    <div
      className="gd-toolbar gd-toolbar-mobile"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {canGoBack && (
        <button
          className="gd-icon-btn gd-toolbar-back"
          aria-label="Back to parent folder"
          disabled={disabled}
          onClick={handleBack}
        >
          <IconBack />
        </button>
      )}

      <h1 className="gd-toolbar-title" title={title}>
        {title}
      </h1>

      <div className="gd-toolbar-actions">
        <button
          className="gd-icon-btn"
          aria-label="Search"
          onClick={() => setSearching(true)}
        >
          <IconSearch />
        </button>
        <button
          className="gd-icon-btn"
          aria-label="More options"
          aria-haspopup="dialog"
          onClick={(e) => onContextMenu?.(e, itemId)}
        >
          <IconMore />
        </button>
      </div>
    </div>
  );
}
