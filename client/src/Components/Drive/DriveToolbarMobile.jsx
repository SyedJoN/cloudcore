import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { getRouteConfig } from "../../../Utils/routeConfig";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";

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

// helpers
const getName = (item) =>
  item && typeof item === "object" ? item.name : (item ?? "");

const isValidCrumb = (c) => c && Object.keys(c).length > 0;

// component
export default function DriveToolbarMobile({
  dirId,
  dirContext,
  path = [],
  setPath,
  crumbs = [],
  setCrumbs,
  handleSelect,
  setInDirectory,
  disabled,
  restartAnimation,
  onSearch,
  onContextMenu,
}) {
  const navigate = useNavigate();
  const { path: rootPath } = getRouteConfig(dirContext);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const current = path.at(-1);
  const parent = path.at(-2);

  const title = getName(current);
  const canGoBack = path.length > 0;

  const validCrumbs = useMemo(() => crumbs.filter(isValidCrumb), [crumbs]);

  useEffect(() => {
    const lastCrumb = validCrumbs.at(-1);
    if (!lastCrumb) return;
    if (dirId && lastCrumb.id !== dirId) return; // stale crumbs
    if (current?.id === lastCrumb.id) return; // already in sync
    setPath(validCrumbs);
  }, [validCrumbs, dirId]);

  useEffect(() => {
    setSearching(false);
    setQuery("");
  }, [dirId]);

  // handlers
  const handleBack = () => {
    if (disabled || !canGoBack) return;

    setPath((prev) => prev.slice(0, -1));

    if (parent?.id) {
      navigate(`/directory/${parent.id}`, { state: { dirContext } });
    } else {
      setCrumbs?.([]);
      navigate(rootPath);
      setInDirectory?.(false);
    }

    restartAnimation?.();
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    onSearch?.("");
  };

  const submitSearch = (e) => {
    e.preventDefault();
    e.currentTarget.querySelector("input")?.blur(); // keyboard dismiss
  };

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  // search mode
  if (searching) {
    return (
      <div
        className="gd-toolbar-mobile"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="gd-icon-btn w-5! h-5! ml-2.5"
          aria-label="Close search"
          onClick={closeSearch}
        >
          <ArrowLeftIcon />
        </button>

        <form
          className="gd-toolbar-search w-full rounded-full overflow-hidden"
          onSubmit={submitSearch}
          role="search"
        >
          <input
            autoFocus
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder={`Search in ${title}`}
            aria-label="Search"
            enterKeyHint="search"
            className="w-full rounded-full px-5 py-3 outline-none"
          />
        </form>
      </div>
    );
  }

  // normal mode
  return (
    <div className="gd-toolbar-mobile" onMouseDown={(e) => e.stopPropagation()}>
      <button
        className="gd-icon-btn gd-toolbar-back"
        aria-label="Back to parent folder"
        disabled={disabled || !canGoBack}
        onClick={handleBack}
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </button>

      <h1 className="gd-toolbar-title" title={title}>
        {title}
      </h1>

      <div className="gd-toolbar-actions">
        <button
          className="gd-icon-btn"
          aria-label="Search"
          onClick={() => setSearching(true)}
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
        <button
          className="gd-icon-btn"
          aria-label="More options"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.stopPropagation();
            handleSelect?.(dirId);
            onContextMenu?.(e, dirId);
          }}
        >
          <EllipsisVerticalIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
