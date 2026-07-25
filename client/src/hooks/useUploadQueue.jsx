import { useState, useRef, useCallback } from "react";
import {
  deleteFile,
  getSignedUploadUrl,
  notifyBackend,
} from "../../apis/fileApi";
import { formatSize } from "../../Utils/formatHelpers";
import { useAuth } from "../Contexts";

/**
 * Owns the upload queue: selecting files, validating size/storage limits,
 * running uploads one-by-one via XHR (for progress events), and cancellation.
 */
export function useUploadQueue({ dirId,showError, onQueueComplete }) {
  const {user, refreshUser} = useAuth();
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadXhrMap, setUploadXhrMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [dbFileId, setDbFileId] = useState("");
  const fileInputRef = useRef(null);


  const isUploadingRef = useRef(false);

  const handleCancelUpload = useCallback(
    async (tempId, fileId) => {
      uploadXhrMap[tempId]?.abort();

      if (fileId) {
        try {
          await deleteFile(`/file/${fileId}`);
        } catch (err) {
          console.error("Delete failed:", err);
        }
      }

      setUploadQueue((prev) => prev.filter((i) => i._id !== tempId));
      setProgressMap((prev) => {
        const { [tempId]: _omit, ...rest } = prev;
        return rest;
      });
      setUploadXhrMap((prev) => {
        const copy = { ...prev };
        delete copy[tempId];
        return copy;
      });
      isUploadingRef.current = false;
      setIsUploading(false);
    },
    [uploadXhrMap],
  );

  const processUploadQueue = useCallback(
    async (queue) => {
      if (!queue.length) {
        setUploadQueue([]);
        setTimeout(() => {
          onQueueComplete?.();
          isUploadingRef.current = false;
          setIsUploading(false);
        }, 1000);
        return;
      }

      const [current, ...rest] = queue;

      if (current.size > user.uploadLimit) {
        showError(`File ${current.name} exceeds 10MB limit`);
        await processUploadQueue(rest);
        return;
      }

      const totalStorageLeft = user.totalStorage - user.totalUsage;
      const needed = Number(current.size) - totalStorageLeft;

      if (Number(current.size) > totalStorageLeft) {
        showError(`Storage is full. You need ${formatSize(needed)} more storage client`);
        await refreshUser();
        await handleCancelUpload(current._id);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await processUploadQueue(rest);
        return;
      }

      try {
        const { uploadUrl, fileId } = await getSignedUploadUrl({
          name: current.file.name,
          size: current.file.size,
          contentType: current.file.type,
          parentDirId: dirId,
        });
        setDbFileId(fileId);

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.withCredentials = true;

        xhr.upload.addEventListener("progress", (evt) => {
          if (evt.lengthComputable) {
            setProgressMap((prev) => ({
              ...prev,
              [current._id]: (evt.loaded / evt.total) * 100,
            }));
          }
        });

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            await notifyBackend(fileId);
            await refreshUser();
            await processUploadQueue(rest);
          } else {
            console.error("Upload failed:", xhr.status, xhr.responseText);
            showError("Upload failed");
            await handleCancelUpload(current._id, fileId);
            await processUploadQueue(rest);
            isUploadingRef.current = false;
            setIsUploading(false);
          }
        };

        xhr.addEventListener("error", async () => {
          console.error("Network error during upload");
          showError("Network error during upload");
          await handleCancelUpload(current._id);
        });

        xhr.addEventListener("abort", async () => {
          console.warn("Upload aborted");
          await processUploadQueue(rest);
        });

        setUploadXhrMap((prev) => ({ ...prev, [current._id]: xhr }));
        xhr.setRequestHeader("Content-Type", current.file.type);
        xhr.send(current.file);
      } catch (error) {
        showError(error.message || "Failed fetching uploadUrl");
        await processUploadQueue(rest);
      }
    },
    [dirId, user, refreshUser, showError, handleCancelUpload, onQueueComplete],
  );

  const handleFileSelect = useCallback(
    (e) => {
      showError("");
      const selected = Array.from(e.target.files);

      if (user.uploadLimit !== null && user.uploadLimit == 0) {
        showError("Uploads are paused. Please complete your payment to continue");
        e.target.value = "";
        return;
      }

      if (!selected.length) return;

      const validFiles = selected.filter((file) => file.size <= user.uploadLimit);
      e.target.value = "";

      if (!validFiles.length) {
        showError("Max upload size limit reached!");
        return;
      }

      if (validFiles.length !== selected.length) {
        showError("Some files are skipped due to size limit");
      }

      const newItems = validFiles.map((file) => ({
        file,
        size: file.size,
        name: file.name,
        _id: `temp-${Date.now()}-${Math.random()}`,
        isUploading: false,
      }));

      newItems.forEach((item) =>
        setProgressMap((prev) => ({ ...prev, [item._id]: 0 })),
      );

      setUploadQueue((prev) => [...prev, ...newItems]);

      // Plain side effects, run once, outside of any setState updater.
      // Gated on the ref (synchronous) rather than `isUploading` state
      // (async/batched) so two rapid selections can't both pass the check.
      if (!isUploadingRef.current) {
        isUploadingRef.current = true;
        setIsUploading(true);
        processUploadQueue(newItems);
      }
    },
    [user, showError, processUploadQueue],
  );

  return {
    fileInputRef,
    uploadQueue,
    progressMap,
    isUploading,
    dbFileId,
    handleFileSelect,
    handleCancelUpload,
  };
}