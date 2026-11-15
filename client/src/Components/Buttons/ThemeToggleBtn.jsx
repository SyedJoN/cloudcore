import { useTheme } from "../../Contexts/ThemeContext";

export function ThemeToggleBtn() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="cursor-pointer"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

export function ThemeToggleBtnMobile() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        isDark ? "bg-(--accent-blue-light)" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
          isDark ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
