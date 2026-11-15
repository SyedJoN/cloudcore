import { useState, useRef, useEffect } from "react";
import "./RecentFilters.css";
import { CATEGORY_LABELS } from "./ItemCategory";
import { UseAvatar } from "../../../Hooks/useAvatar"; 
import CategoryIcon from "../CategoryIcon";

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


const summarize = (labels) => {
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
};

const ownerKeyOf = (owner) => owner._id || owner.name || owner.permissionId;

function FilterDropdown({ label, activeLabel, onClear, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = Boolean(activeLabel);

  const handleClose = () => setOpen(false);

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
        <span className="gd-filter-btn-label">
          {active ? activeLabel : label}
        </span>
        {!active && <span className="gd-filter-caret">▾</span>}
      </button>

      {active && (
        <button
          type="button"
          className="gd-filter-x"
          aria-label={`Clear ${label} filter`}
          onClick={() => {
            setOpen(false);
            onClear();
          }}
        >
          ×
        </button>
      )}

      {/* onChange input se upar bubble hota hai: koi bhi option chunte hi dropdown band */}
      {open && (
        <div className="gd-filter-dropdown" onChange={handleClose}>
          {children}
        </div>
      )}
    </div>
  );
}

// Checkbox / radio ki jagah sirf tick. Chuni hui row accent-blue-light se highlight hoti hai.
// Asli input visually hidden rehta hai, taake keyboard aur screen reader kaam karein.
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

function TickOption({
  checked,
  onChange,
  type = "checkbox",
  name,
  icon,
  children,
}) {
  return (
    <label
      className={`gd-filter-option gd-filter-tick ${checked ? "checked" : ""}`}
    >
      <input
        type={type}
        name={name}
        className="gd-sr-only"
        checked={checked}
        onChange={onChange}
      />

      {icon && (
        <span className="gd-tick-slot" aria-hidden="true">
          {checked ? <TickSvg /> : icon}
        </span>
      )}
      {!icon && (
        <span className="gd-tick-slot" aria-hidden="true">
          {checked && <TickSvg />}
        </span>
      )}
      {children}
    </label>
  );
}

function PersonOption({ checked, onChange, name, subtitle, avatar }) {
  return (
    <label
      className={`gd-filter-option gd-filter-person ${checked ? "checked" : ""}`}
    >
      <input
        type="checkbox"
        className="gd-sr-only"
        checked={checked}
        onChange={onChange}
      />

      <span className="gd-person-avatar">
        <UseAvatar name={name} avatar={avatar} size={28} />
        {checked && (
          <span className="gd-person-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="10" height="10">
              <path
                d="m5 12 4 4L19 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>

      <span className="gd-person-text">
        <span className="gd-person-name">{name}</span>
        {subtitle && <span className="gd-person-email">{subtitle}</span>}
      </span>
    </label>
  );
}

export default function RecentFilters({
  items,
  filters,
  onChange,
  isRecentRoute = false,
  user,
}) {
  const owners = Array.from(
    new Map(
      items
        .filter((i) =>
          i.owners?.[0]
            ? i.owners?.[0].emailAddress !== user?.email
            : i.userId?.email && i.userId.email !== user?.email,
        )
        .map((i) =>
          i.owners?.[0]?.emailAddress
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

  const typeActiveLabel = summarize(
    [...filters.types].map((key) => CATEGORY_LABELS[key]).filter(Boolean),
  );

  const ownerLabelByKey = new Map(
    owners.map((o) => [ownerKeyOf(o), o.name || o.displayName]),
  );
  const peopleActiveLabel = summarize(
    [...filters.people]
      .map((key) => (key === "me" ? "Owned by me" : ownerLabelByKey.get(key)))
      .filter(Boolean),
  );

  const modifiedActiveLabel =
    filters.modified !== "anytime"
      ? MODIFIED_OPTIONS.find((o) => o.key === filters.modified)?.label
      : null;

  return (
    <div className="gd-recent-filters">
      <FilterDropdown
        label="Type"
        activeLabel={typeActiveLabel}
        onClear={() => onChange({ ...filters, types: new Set() })}
      >
        {TYPE_OPTIONS.map((opt) => {
          if (isRecentRoute && opt.key === "folder") return null;
          return (
            <TickOption
              key={opt.key}
              checked={filters.types.has(opt.key)}
              onChange={() => toggleSetValue("types", opt.key)}
              icon={<CategoryIcon type={opt.key} />}
            >
              {opt.label}
            </TickOption>
          );
        })}
      </FilterDropdown>

      <FilterDropdown
        label="People"
        activeLabel={peopleActiveLabel}
        onClear={() => onChange({ ...filters, people: new Set() })}
      >
        <PersonOption
          checked={filters.people.has("me")}
          onChange={() => toggleSetValue("people", "me")}
          name="Owned by me"
          subtitle={user?.email}
          avatar={user?.avatar}
        />
        {owners.length > 0 && <div className="gd-filter-divider" />}
        {owners.map((owner) => {
          const key = ownerKeyOf(owner);
          return (
            <PersonOption
              key={key}
              checked={filters.people.has(key)}
              onChange={() => toggleSetValue("people", key)}
              name={owner.name || owner.displayName}
              subtitle={owner.email || owner.emailAddress}
              avatar={owner.avatar || owner.photoLink}
            />
          );
        })}
      </FilterDropdown>

      <FilterDropdown
        label="Modified"
        activeLabel={modifiedActiveLabel}
        onClear={() => setModified("anytime")}
      >
        {MODIFIED_OPTIONS.map((opt) => (
          <TickOption
            key={opt.key}
            type="radio"
            name="gd-modified-filter"
            checked={filters.modified === opt.key}
            onChange={() => setModified(opt.key)}
          >
            {opt.label}
          </TickOption>
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
