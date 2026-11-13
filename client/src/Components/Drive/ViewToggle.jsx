import {
  Bars3Icon,
  CheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import "./ViewToggle.css";

const OPTIONS = [
  { mode: "list", label: "List layout", Icon: Bars3Icon },
  { mode: "grid", label: "Grid layout", Icon: Squares2X2Icon },
];

export default function ViewToggle({ viewMode, onToggleView }) {
  return (
    <div role="group" aria-label="Layout" className="gd-view-toggle">
      {OPTIONS.map(({ mode, label, Icon }) => {
        const selected = viewMode === mode;

        return (
          <button
            key={mode}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => !selected && onToggleView()}
            className={`gd-view-toggle-btn ${selected ? "selected" : ""}`}
          >
            <span className="gd-view-toggle-check-wrap" aria-hidden="true">
              <CheckIcon className="gd-view-toggle-check" strokeWidth={2.5} />
            </span>
            <Icon className="gd-view-toggle-icon" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}