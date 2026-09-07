import { useTheme } from "../../Contexts/ThemeContext";


function ThemeToggleBtn() {
  const { theme, setTheme } = useTheme();

  return (
    <button className="cursor-pointer"
      onClick={() =>
        setTheme(theme === "light" ? "dark" : "light")
      }
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
export default ThemeToggleBtn;