import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { useAuth, useGDrive, useToast } from "../../Contexts";

import { uploadGoogleDriveFile } from "./uploadGoogleDriveFile"; // adjust to your actual path
import { savePendingDriveFile } from "./PendingGoogleDriveFile";
import { redirectToGoogleDriveAuth } from "../../Hooks/useGoogleDriveAuth";
import { useParams } from "react-router-dom";
import { useEffect } from "react";

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
  const { dirId } = useParams();
  const { isGoogleDrive } = useGDrive();

  if (!open) return null;

  return (
    <DrivePicker
      client-id={import.meta.env.VITE_GOOGLE_CLIENT_ID}
      app-id={import.meta.env.VITE_GOOGLE_APP_ID}
      scope="https://www.googleapis.com/auth/drive.readonly"
      onPicked={async (e) => {
        const selected = e.detail.docs[0];
        const pickedFile = {
          id: selected.id,
          name: selected.name,
          size: selected.sizeBytes,
          contentType: selected.mimeType,
          dirId: dirId,
        };

        if (user.uploadLimit !== null && user.uploadLimit == 0) {
          toast({
            message:
              "Uploads are paused. Please complete your payment to continue",
            type: "warning",
          });
          return;
        }

        if (pickedFile.size >= user.uploadLimit) {
          showError("Max upload size limit reached!");
          return;
        }

        if (!isGoogleDrive) {
          savePendingDriveFile(pickedFile);
          setOpen(false);
          redirectToGoogleDriveAuth(dirId);
          return;
        }

        setOpen(false);

        try {
          await uploadGoogleDriveFile(pickedFile, {
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
            savePendingDriveFile(pickedFile);
            redirectToGoogleDriveAuth(dirId);
          }
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
