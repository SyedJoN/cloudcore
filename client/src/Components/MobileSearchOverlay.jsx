import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { IconFolder } from "../Components/Icons/Icons";
import FileBadge from "../Components/File/FileBadge";
import { UseAvatar } from "../Hooks/useAvatar";
import { useAuth } from "../Contexts";
import { useSearch } from "../Hooks/useSearch";
import { useRecentSearches } from "../Hooks/useRecentSearches";
import { getFileKind } from "../../Utils/fileKind";
import CategoryIcon from "../Components/Drive/CategoryIcon";
import { CATEGORY_LABELS } from "../Components/Drive/Recent/ItemCategory";
import "./MobileSearchOverlay.css";
import { BottomSheet } from "./Drive/BottomSheet";


export function useSearchOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const open = Boolean(location.state?.gdSearch);

  const openSearch = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, {
      state: { ...location.state, gdSearch: true },
    });
  }, [navigate, location]);

  const closeSearch = useCallback(() => navigate(-1), [navigate]);

  return { open, openSearch, closeSearch };
}

/* ------------------------------------------------------------------ */

const TYPE_OPTIONS = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
  key,
  label,
}));

const MODIFIED_OPTIONS = [
  { key: "anytime", label: "Anytime" },
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisYear", label: "This year" },
  { key: "lastYear", label: "Last year" },
];

const currentYear = new Date().getFullYear();

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== currentYear && { year: "numeric" }),
  });
};

const summarize = (labels) => {
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
};

const TickSvg = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M5 12.5 9.5 17 19 7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* components */

function FilterChip({ label, activeLabel, onClick, onClear }) {
  const active = Boolean(activeLabel);

  return (
    <div className={`ms-chip ${active ? "active" : ""}`}>
      <button type="button" className="ms-chip-main" onClick={onClick}>
        <span className="ms-chip-label">{active ? activeLabel : label}</span>
        {!active && <span className="ms-chip-caret">▾</span>}
      </button>
      {active && (
        <button
          type="button"
          className="ms-chip-x"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;

  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="ms-mark">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function ResultRow({ item, query, isMine, onClick }) {
  const iconType = item.isDirectory ? null : getFileKind(item);

  const owner = isMine ? "You" : item.userId?.name || item.userId?.email || "";
  const when = formatDate(item.modifiedTime ?? item.updatedAt);

  const parent = item.parentDirId;
  const parentName = parent && typeof parent === "object" ? parent.name : "";
  const isRootParent = String(parentName ?? "").startsWith("root");
  const location = isRootParent ? (isMine ? "My Drive" : "") : parentName;

  const subtitle = [owner, when, location].filter(Boolean).join(" • ");

  return (
    <button type="button" className="ms-row" onClick={onClick}>
      <span className="ms-row-icon">
        {item.isDirectory ? <IconFolder size={36} /> : <FileBadge size={36} type={iconType} />}
      </span>
      <span className="ms-row-text">
        <span className="ms-row-title">
          <Highlight text={item.name ?? ""} query={query} />
        </span>
        {subtitle && <span className="ms-row-sub">{subtitle}</span>}
      </span>
    </button>
  );
}

function SheetRow({ checked, onClick, lead, tickInLead = false, children }) {
  return (
    <button
      type="button"
      className={`ms-sheet-row ${checked ? "checked" : ""}`}
      aria-pressed={checked}
      onClick={onClick}
    >
      <span className="ms-sheet-lead">
        {tickInLead && checked ? <TickSvg /> : lead}
      </span>
      <span className="ms-sheet-text">{children}</span>
      {!tickInLead && checked && (
        <span className="ms-sheet-tick">
          <TickSvg />
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export default function MobileSearchOverlay({ onOpenItem }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open, closeSearch } = useSearchOverlay();

  const inputRef = useRef(null);
  const [sheet, setSheet] = useState(null); // "type" | "people" | "modified" | null

  const search = useSearch({ enabled: open, myId: user?._id });
  const recent = useRecentSearches();
  const { query, setQuery, filters, setFilters, items, status, owners } = search;

  useEffect(() => {
    if (!open) {
      search.reset();
      setSheet(null);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => inputRef.current?.focus(), 80);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const ownerById = useMemo(
    () => new Map(owners.map((o) => [String(o._id), o])),
    [owners],
  );

  const toggleFilter = (key, value) =>
    setFilters((prev) => {
      const next = new Set(prev[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...prev, [key]: next };
    });

  const clearFilter = (key) =>
    setFilters((prev) => ({ ...prev, [key]: new Set() }));

  /* ---------- chip values ---------- */

  const typeLabel = summarize(
    [...filters.types].map((k) => CATEGORY_LABELS[k]).filter(Boolean),
  );

  const peopleLabel = summarize(
    [...filters.people]
      .map((k) =>
        k === "me"
          ? "Owned by me"
          : k === "others"
            ? "Not owned by me"
            : ownerById.get(String(k))?.name,
      )
      .filter(Boolean),
  );

  const modifiedLabel =
    filters.modified !== "anytime"
      ? MODIFIED_OPTIONS.find((o) => o.key === filters.modified)?.label
      : null;

  /* ---------- handlers ---------- */

  const handleSubmit = (e) => {
    e.preventDefault();
    recent.add(query);
    inputRef.current?.blur();
  };

  const handleOpen = (item) => {
    recent.add(query);
    inputRef.current?.blur();

    if (item.isDirectory) {
      navigate(`/directory/${item._id}`, {
        replace: true,
        state: { dirContext: item.rootType === "shared" ? "shared" : "drive" },
      });
      return;
    }

    if (onOpenItem) {
      onOpenItem(item);
      return;
    }


    const parent = item.parentDirId?._id ?? item.parentDirId;
    navigate(parent ? `/directory/${parent}` : "/drive", { replace: true });
  };

  const isMineItem = (item) =>
    item.rootType
      ? item.rootType === "mine"
      : String(item.userId?._id ?? item.userId) === String(user?._id);

  /* ---------- body ---------- */

  let content;

  if (!search.isActive) {
    content = recent.items.length ? (
      <div className="ms-recent">
        <div className="ms-section">
          <span>Recent searches</span>
          <button type="button" onClick={recent.clear}>
            Clear all
          </button>
        </div>
        {recent.items.map((text) => (
          <div key={text} className="ms-recent-row">
            <button
              type="button"
              className="ms-recent-main"
              onClick={() => {
                setQuery(text);
                inputRef.current?.focus();
              }}
            >
              <ClockIcon className="h-5 w-5" />
              <span>{text}</span>
            </button>
            <button
              type="button"
              className="ms-icon-btn"
              aria-label={`Remove ${text}`}
              onClick={() => recent.remove(text)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="ms-state">Search files and folders in your Drive</div>
    );
  } else if (status === "error") {
    content = <div className="ms-state">Something went wrong. Please try again.</div>;
  } else if (status === "loading" && items.length === 0) {
    content = (
      <div className="ms-state">
        <div className="gd-spinner" />
      </div>
    );
  } else if (status === "done" && items.length === 0) {
    content = (
      <div className="ms-state">
        {query.trim() ? `No results for “${query.trim()}”` : "No files match these filters"}
      </div>
    );
  } else {
    content = items.map((item) => (
      <ResultRow
        key={item._id}
        item={item}
        query={query}
        isMine={isMineItem(item)}
        onClick={() => handleOpen(item)}
      />
    ));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`ms-overlay ${open ? "open" : ""}`}
      role="dialog"
      aria-label="Search"
      inert={open ? undefined : ""}
    >
      {/* search bar */}
      <form className="ms-top" onSubmit={handleSubmit} role="search">
        <button
          type="button"
          className="ms-icon-btn"
          aria-label="Back"
          onClick={closeSearch}
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>

        <input
          ref={inputRef}
          className="ms-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in Drive"
          aria-label="Search"
          enterKeyHint="search"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            className="ms-icon-btn"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </form>

      {/* filters */}
      <div className="ms-chips">
        <FilterChip
          label="Type"
          activeLabel={typeLabel}
          onClick={() => setSheet("type")}
          onClear={() => clearFilter("types")}
        />
        <FilterChip
          label="People"
          activeLabel={peopleLabel}
          onClick={() => setSheet("people")}
          onClear={() => clearFilter("people")}
        />
        <FilterChip
          label="Modified"
          activeLabel={modifiedLabel}
          onClick={() => setSheet("modified")}
          onClear={() => setFilters((p) => ({ ...p, modified: "anytime" }))}
        />
      </div>

      {/* recent searches / results */}
      <div className="ms-body">{open && content}</div>

      {/* Type */}
      <BottomSheet zIndex={600} open={sheet === "type"} onClose={() => setSheet(null)}>
        <div className="ms-sheet">
          <div className="ms-sheet-title">Type</div>
          <div className="ms-sheet-list">
            {TYPE_OPTIONS.map(({ key, label }) => (
              <SheetRow
                key={key}
                checked={filters.types.has(key)}
                onClick={() => toggleFilter("types", key)}
                lead={<CategoryIcon type={key} />}
                tickInLead
              >
                {label}
              </SheetRow>
            ))}
          </div>
          <button type="button" className="ms-sheet-done" onClick={() => setSheet(null)}>
            Done
          </button>
        </div>
      </BottomSheet>

      {/* People */}
      <BottomSheet zIndex={600} open={sheet === "people"} onClose={() => setSheet(null)}>
        <div className="ms-sheet">
          <div className="ms-sheet-title">People</div>
          <div className="ms-sheet-list">
            <SheetRow
              checked={filters.people.has("me")}
              onClick={() => toggleFilter("people", "me")}
              lead={<UseAvatar name={user?.name} avatar={user?.avatar} size={32} />}
            >
              Owned by me
            </SheetRow>
            <SheetRow
              checked={filters.people.has("others")}
              onClick={() => toggleFilter("people", "others")}
              lead={
                <span className="ms-person-fallback">
                  <UserIcon className="h-5 w-5" />
                </span>
              }
            >
              Not owned by me
            </SheetRow>

            {owners.map((owner) => (
              <SheetRow
                key={owner._id}
                checked={filters.people.has(String(owner._id))}
                onClick={() => toggleFilter("people", String(owner._id))}
                lead={<UseAvatar name={owner.name} avatar={owner.avatar} size={32} />}
              >
                <span className="ms-person-name">{owner.name}</span>
                {owner.email && <span className="ms-person-email">{owner.email}</span>}
              </SheetRow>
            ))}
          </div>
          <button type="button" className="ms-sheet-done" onClick={() => setSheet(null)}>
            Done
          </button>
        </div>
      </BottomSheet>

      {/* Modified */}
      <BottomSheet zIndex={600} open={sheet === "modified"} onClose={() => setSheet(null)}>
        <div className="ms-sheet">
          <div className="ms-sheet-title">Modified</div>
          <div className="ms-sheet-list">
            {MODIFIED_OPTIONS.map(({ key, label }) => (
              <SheetRow
                key={key}
                checked={filters.modified === key}
                onClick={() => {
                  setFilters((prev) => ({ ...prev, modified: key }));
                  setSheet(null);
                }}
                lead={null}
              >
                {label}
              </SheetRow>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>,
    document.body,
  );
}