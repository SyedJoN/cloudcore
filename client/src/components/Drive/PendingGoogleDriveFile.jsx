const STORAGE_KEY = "pendingGoogleDriveFile";

export function savePendingDriveFile(file) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

export function getPendingDriveFile() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingDriveFile() {
  sessionStorage.removeItem(STORAGE_KEY);
}