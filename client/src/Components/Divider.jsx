export function Divider({fullWidth = false}) {
  return (
    <div
      className={`my-2 h-px bg-(--border) ${fullWidth ? "-ml-6 -mr-6" : "ml-6"}`}
    />
  );
}
