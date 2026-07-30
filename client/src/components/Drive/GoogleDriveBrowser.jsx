import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import {
  getSignedUploadUrl,
  notifyBackend,
  uploadDriveFileToS3,
} from "../../../apis/fileApi";
import { useAuth, useGDrive, useToast } from "../../Contexts";
import { redirectToGoogleDriveAuth } from "../../Hooks/useGoogleDriveAuth";
function GoogleDriveBrowser({
  open,
  setOpen,
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
  const { isGoogleDrive } = useGDrive();
  if (!open) return null;

  return (
    <DrivePicker
      client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID}
      app-id={import.meta.env.VITE_GOOGLE_APP_ID}
      scope="https://www.googleapis.com/auth/drive.readonly"
      onPicked={async (e) => {
        if (!isGoogleDrive) {
          redirectToGoogleDriveAuth();
          return;
        }
        const selected = e.detail.docs[0];
        const { id, name, sizeBytes: size, mimeType: contentType } = selected;
        const type = "google";

        if (user.uploadLimit !== null && user.uploadLimit == 0) {
          toast({
            message:
              "Uploads are paused. Please complete your payment to continue",
            type: "warning",
          });
          return;
        }

        if (size >= user.uploadLimit) {
          showError("Max upload size limit reached!");
          return;
        }

        // Show it in the tray immediately, same shape as a normal queue item.
        enqueueItem({ _id: id, name, size });

        try {
          const { uploadUrl, fileId } = await getSignedUploadUrl({
            name,
            size,
            contentType,
            type,
          });
          setDbFileId(fileId);

          const response = await uploadDriveFileToS3(fileId, id);
          const bytes = new Uint8Array(response.data.buffer.data);

          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.withCredentials = true;

          xhr.upload.addEventListener("progress", (evt) => {
            if (evt.lengthComputable) {
              setItemProgress(id, (evt.loaded / evt.total) * 100);
            }
          });

          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              await notifyBackend(fileId);
              await refreshUser();
              completeItem(id);
              onUploadComplete?.();
            } else {
              console.error("Upload failed:", xhr.status, xhr.responseText);
              await handleCancelUpload(id, fileId);
            }
          };

          xhr.addEventListener("error", async () => {
            console.error("Network error during upload");
            await handleCancelUpload(id, fileId);
          });

          xhr.addEventListener("abort", () => {
            console.warn("Upload aborted");
          });

          xhr.setRequestHeader("Content-Type", contentType);
          xhr.send(bytes);
        } catch (error) {
          console.error("err", error);
          await handleCancelUpload(id);
        } finally {
          setOpen(false);
        }
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
