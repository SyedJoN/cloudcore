export default function DirectoryEmptyState() {
  return (
    <div className="gd-empty">
      <svg width="120" height="120" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="80" fill="#f1f3f4" />
        <path d="M60 130 L80 90 L120 90 L140 130 Z" fill="#dadce0" />
        <path d="M80 90 L100 50 L120 90" fill="#bdc1c6" />
      </svg>
      <h3>This folder is empty</h3>
      <p>Drop files here or use the New button to add files and folders.</p>
    </div>
  );
}