import { useState, useRef, useEffect } from "react";
import "./RecentFilters.css";
import { CATEGORY_LABELS } from "./itemCategory";

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

function FilterDropdown({ label, active, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="gd-filter" ref={ref}>
      <button
        type="button"
        className={`gd-filter-btn ${active ? "gd-filter-btn-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="gd-filter-caret">▾</span>
      </button>
      {open && <div className="gd-filter-dropdown">{children}</div>}
    </div>
  );
}

export default function RecentFilters({ items, filters, onChange, user }) {
  const owners = Array.from(
    new Map(
      items
        .filter((i) =>
          i.owners?.[0]
            ? i.owners?.[0].emailAddress !== user?.email
            : i.userId?.email && i.userId.email !== user?.email,
        )
        .map((i) =>
          i.owners?.[0].emailAddress
            ? [i.owners[0].permissionId, i.owners[0]]
            : [i.userId._id ?? i.userId.name, i.userId],
        ),
    ).values(),
  );

  function toggleSetValue(key, value) {
    const next = new Set(filters[key]);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange({ ...filters, [key]: next });
  }

  function setModified(value) {
    onChange({ ...filters, modified: value });
  }

  function clearAll() {
    onChange({ types: new Set(), people: new Set(), modified: "anytime" });
  }

  const hasActiveFilters =
    filters.types.size > 0 ||
    filters.people.size > 0 ||
    filters.modified !== "anytime";

  return (
    <div className="gd-recent-filters">
      <FilterDropdown label="Type" active={filters.types.size > 0}>
        {TYPE_OPTIONS.map((opt) => (
          <label key={opt.key} className="gd-filter-option">
            <input
              type="checkbox"
              checked={filters.types.has(opt.key)}
              onChange={() => toggleSetValue("types", opt.key)}
            />
            {opt.label}
          </label>
        ))}
      </FilterDropdown>

      <FilterDropdown label="People" active={filters.people.size > 0}>
        <label className="gd-filter-option">
          <input
            type="checkbox"
            checked={filters.people.has("me")}
            onChange={() => toggleSetValue("people", "me")}
          />
          Owned by me
        </label>
        {owners.length > 0 && <div className="gd-filter-divider" />}
        {owners.map((owner) => {
          const key = owner._id || owner.name || owner.permissionId;
          return (
            <label key={key} className="gd-filter-option">
              <input
                type="checkbox"
                checked={filters.people.has(key)}
                onChange={() => toggleSetValue("people", key)}
              />
              {owner.name || owner.displayName}
            </label>
          );
        })}
      </FilterDropdown>

      <FilterDropdown label="Modified" active={filters.modified !== "anytime"}>
        {MODIFIED_OPTIONS.map((opt) => (
          <label key={opt.key} className="gd-filter-option">
            <input
              type="radio"
              name="gd-modified-filter"
              checked={filters.modified === opt.key}
              onChange={() => setModified(opt.key)}
            />
            {opt.label}
          </label>
        ))}
      </FilterDropdown>

      {hasActiveFilters && (
        <button type="button" className="gd-filter-clear" onClick={clearAll}>
          Clear filters
        </button>
      )}
    </div>
  );
}
