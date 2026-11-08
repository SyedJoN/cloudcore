import {
  Star,
  Users,
  FolderOpen,
  Clock,
  Cloud,
  Trash2,
} from "lucide-react";

export default function DriveEmptyState({ isMobile, route }) {

  const isGoogleDriveRoute = route === "google-drive";
  const isStarredRoute = route === "starred";
  const isSharedRoute = route === "shared";
  const isRecentRoute = route === "recent";
  const isTrashRoute = route === "trash";

  const EmptyIcon = isGoogleDriveRoute
    ? Cloud
    : isStarredRoute
      ? Star
      : isSharedRoute
        ? Users
        : isRecentRoute
          ? Clock
          : isTrashRoute
            ? Trash2
            : FolderOpen;

  let title = "This folder is empty";

  let description = isMobile
    ? "Files and folders you add will appear here. Tap the + button to get started."
    : "Drop files here or use the New button to add files and folders.";

  if (isGoogleDriveRoute) {
    title = "Your Google Drive is ready";
    description =
      "Choose files from the New button to add them to your Google Drive and access them here anytime.";
  } else if (isStarredRoute) {
    title = "No starred files yet";
    description =
      "Star important files and folders to find them quickly. They'll appear here for easy access.";
  } else if (isSharedRoute) {
    title = "Nothing shared with you yet";
    description =
      "Files and folders shared with you by others will appear here. Once shared, you can access them anytime.";
  } else if (isRecentRoute) {
    title = "No recent files";
    description =
      "Files you've recently opened or worked on will appear here, making it easy to pick up where you left off.";
  } else if (isTrashRoute) {
    title = "Trash is empty";
    description =
      "Files you delete will appear here. You can restore them or permanently delete them whenever you like.";
  }

  return (
    <div className={`gd-empty ${isMobile ? "gd-empty-mobile" : ""}`}>
      <EmptyIcon
        size={48}
        strokeWidth={1.4}
        className="gd-empty-icon"
      />

      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}