export default function DriveEmptyState({ device, isGoogleDriveRoute }) {
  const isMobile = device === "mobile";

  const title = isGoogleDriveRoute
    ? "Your Google Drive is ready"
    : "This folder is empty";

  const description = isGoogleDriveRoute
    ? "Choose files from the New button to add them to your Google Drive and access them here anytime."
    : isMobile
      ? "Files and folders you add will appear here. Tap the + button to get started."
      : "Drop files here or use the New button to add files and folders.";

  return (
    <div
      className={`gd-empty ${isMobile ? "gd-empty-mobile" : ""}`}
    >
      <svg width="120" height="120" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="80" fill="#f1f3f4" />
        <path d="M60 130 L80 90 L120 90 L140 130 Z" fill="#dadce0" />
        <path d="M80 90 L100 50 L120 90" fill="#bdc1c6" />
      </svg>

      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}