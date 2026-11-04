import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DrivePicker, DrivePickerDocsView } from "@googleworkspace/drive-picker-react";
import { useAuth, useGDrive, useToast } from "../../Contexts";
import { redirectToGoogleDriveAuth } from "../../Hooks/useGoogleDriveAuth";
import { savePendingDriveFile } from "./PendingGoogleDriveFile";
import { uploadGoogleDriveFile } from "./uploadGoogleDriveFile";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const DRIVE_FIELDS = [
  "id",
  "name",
  "mimeType",
  "size",
  "createdTime",
  "modifiedTime",
  "viewedByMeTime",
  "hasThumbnail",
  "thumbnailLink",
  "webViewLink",
  "webContentLink",
  "owners",
  "lastModifyingUser",
  "capabilities",
  "ownedByMe",
  "shared",
].join(",");

// Used only if files.get fails
const DENY_ALL_CAPABILITIES = {
  canEdit: false,
  canShare: false,
  canCopy: false,
  canDownload: false,
  canDelete: false,
  canAddChildren: false,
};
 
// Gets a fresh OAuth access token (drive.file scope) via Google Identity
// Services. Nothing is cached or stored: one token per picker session.
const requestDriveToken = (loginHint) =>
  new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services script not loaded"));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      hint: loginHint, // preselects the right Google account
      callback: (resp) =>
        resp.error ? reject(resp) : resolve(resp.access_token),
      error_callback: reject, // popup closed or blocked
    });
    client.requestAccessToken({ prompt: "" }); // no consent screen if already granted
  });
 
// Map the (small) Picker doc to the same shape your list already uses.
const toCombinedItem = (doc) => ({
  id: doc.id,
  name: doc.name,
  mimeType: doc.mimeType,
  size: doc.sizeBytes != null ? String(doc.sizeBytes) : undefined,
  modifiedTime: doc.lastEditedUtc
    ? new Date(doc.lastEditedUtc).toISOString()
    : undefined,
  webViewLink: doc.url,
  iconLink: doc.iconUrl,
  hasThumbnail: false,
  parents: doc.parentId ? [doc.parentId] : [],
  capabilities: DENY_ALL_CAPABILITIES,
});
 
// Full metadata (includes capabilities). Works because picking a file grants
// the app access to it under the drive.file scope, as long as the same
// OAuth client/token is used for the picker and for this request.
const fetchDriveFile = async (id, token) => {
  if (!token) throw new Error("Missing Drive access token");
 
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=${DRIVE_FIELDS}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
 
  if (!res.ok) throw new Error(`files.get failed: ${res.status}`);
  return res.json();
};
 
function GoogleDriveBrowser({
  open = true, // if the parent only mounts this while the picker should show, leave it undefined
  isGoogleDriveRoute,
  setOpen,
  setFilesList, // pass this from the parent
  showError,
  onUploadComplete,
  enqueueItem,
  setItemProgress,
  completeItem,
  handleCancelUpload,
  setDbFileId,
}) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { dirId } = useParams();
  const { isGoogleDrive } = useGDrive();
 
  const [pickerToken, setPickerToken] = useState(null);
 
  // Request a fresh token each time the picker opens; clear it on close.
  useEffect(() => {
    if (!open) {
      setPickerToken(null);
      return;
    }
 
    let cancelled = false;
    requestDriveToken(user?.email)
      .then((token) => {
        if (!cancelled) setPickerToken(token);
      })
      .catch((err) => {
        console.error("Drive token request failed:", err);
        if (!cancelled) setOpen(false);
      });
 
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
 
  // ---------- Listing route (show picked files in the UI) ----------
 
  // Adds items without duplicating any that are already in the list.
  const addToList = (items) => {
    setFilesList((prev) => {
      const existing = new Set(prev.map((i) => i.id));
      const fresh = items.filter((i) => !existing.has(i.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  };
 
  const handlePickedForList = async (docs) => {
    const items = await Promise.all(
      docs.map(async (doc) => {
        try {
          return await fetchDriveFile(doc.id, pickerToken);
        } catch (error) {
          console.error(`Could not fetch metadata for ${doc.name}:`, error);
          return toCombinedItem(doc);
        }
      })
    );
    addToList(items);
  };
 
  // ---------- Upload flow (one file after another) ----------
 
  const handlePickedForUpload = async (docs) => {
    if (user.uploadLimit != null && user.uploadLimit === 0) {
      toast({
        message: "Uploads are paused. Please complete your payment to continue",
        type: "warning",
      });
      return;
    }
 
    const files = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      size: doc.sizeBytes,
      contentType: doc.mimeType,
      dirId,
    }));
 
    // sizeBytes is undefined for native Google files (Docs, Sheets, Slides),
    // so only compare when we actually have a number.
    const allowed = files.filter((file) => {
      const tooBig =
        user.uploadLimit != null &&
        typeof file.size === "number" &&
        file.size >= user.uploadLimit;
      if (tooBig) showError(`"${file.name}": max upload size limit reached!`);
      return !tooBig;
    });
 
    if (allowed.length === 0) return;
 
    if (!isGoogleDrive) {
      // Note: if savePendingDriveFile stores a single file, make it accept an array.
      allowed.forEach(savePendingDriveFile);
      redirectToGoogleDriveAuth(dirId);
      return;
    }
 
    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i];
      try {
        await uploadGoogleDriveFile(file, {
          enqueueItem,
          setItemProgress,
          completeItem,
          handleCancelUpload,
          setDbFileId,
          refreshUser,
          onUploadComplete,
        });
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          // Auth problem: save this file and the rest, then re-authenticate once.
          allowed.slice(i).forEach(savePendingDriveFile);
          redirectToGoogleDriveAuth(dirId);
          return;
        }
        console.error(`Upload failed for ${file.name}:`, error);
        // other errors: continue with the remaining files
      }
    }
  };
 
  // All hooks are above this line, so this early return is safe.
  if (!open || !pickerToken) return null;
 
  return (
    <DrivePicker
      client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID}
      app-id={import.meta.env.VITE_GOOGLE_APP_ID}
      scope={DRIVE_SCOPE}
      oauth-token={pickerToken}
      multiselect
      onPicked={async (e) => {
        const docs = e.detail?.docs ?? [];
        if (docs.length === 0) return;
 
        setOpen(false);
 
        if (isGoogleDriveRoute) {
          await handlePickedForList(docs);
          return;
        }
 
        await handlePickedForUpload(docs);
      }}
      onCanceled={() => {
        setOpen(false);
      }}
    >
      <DrivePickerDocsView />
    </DrivePicker>
  );
}
 
export default GoogleDriveBrowser;
 