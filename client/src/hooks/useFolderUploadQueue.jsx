import {
  useState,
  useRef,
  useCallback,
} from "react";

import {
  initiateFolderUpload,
  completeFolderUpload,
} from "../../apis/directoryApi.js";

import { formatSize } from "../../Utils/formatHelpers";
import { useAuth } from "../Contexts";

export function useFolderUploadQueue({
  dirId,
  showError,
  onQueueComplete,
}) {
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadXhrMap, setUploadXhrMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [dbFileId, setDbFileId] = useState("");

  const fileInputRef = useRef(null);

  const { user, refreshUser } = useAuth();

  const isUploadingRef = useRef(false);

  // =================================================
  // ADD ITEM
  // =================================================

  const enqueueItem = useCallback((item) => {
    setUploadQueue((prev) => [
      ...prev,
      item,
    ]);

    setProgressMap((prev) => ({
      ...prev,
      [item._id]: 0,
    }));
  }, []);

  // =================================================
  // PROGRESS
  // =================================================

  const setItemProgress = useCallback(
    (id, pct) => {
      setProgressMap((prev) => ({
        ...prev,
        [id]: pct,
      }));
    },
    [],
  );

  // =================================================
  // COMPLETE ITEM
  // =================================================

  const completeItem = useCallback((id) => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) => item._id !== id,
      ),
    );

    setProgressMap((prev) => {
      const {
        [id]: _omit,
        ...rest
      } = prev;

      return rest;
    });
  }, []);

  // =================================================
  // CANCEL
  // =================================================

  const handleCancelUpload = useCallback(
    async (tempId, fileId) => {
      // ---------------------------------------------
      // ABORT S3 UPLOAD
      // ---------------------------------------------

      uploadXhrMap[tempId]?.abort();

      // ---------------------------------------------
      // DELETE BACKEND FILE
      // ---------------------------------------------

      if (fileId) {
        try {
          await fetch(
            `/file/${fileId}`,
            {
              method: "DELETE",
              credentials: "include",
            },
          );
        } catch (error) {
          console.error(
            "Delete failed:",
            error,
          );
        }
      }

      // ---------------------------------------------
      // REMOVE FROM TRAY
      // ---------------------------------------------

      setUploadQueue((prev) =>
        prev.filter(
          (item) =>
            item._id !== tempId,
        ),
      );

      setProgressMap((prev) => {
        const {
          [tempId]: _omit,
          ...rest
        } = prev;

        return rest;
      });

      // ---------------------------------------------
      // REMOVE XHR
      // ---------------------------------------------

      setUploadXhrMap((prev) => {
        const copy = {
          ...prev,
        };

        delete copy[tempId];

        return copy;
      });
    },
    [uploadXhrMap],
  );

  // =================================================
  // SINGLE S3 FILE UPLOAD
  // =================================================

  const uploadSingleFile = useCallback(
    (
      file,
      upload,
      tempId,
    ) => {
      return new Promise(
        (resolve, reject) => {
          const xhr =
            new XMLHttpRequest();

          xhr.open(
            "PUT",
            upload.uploadUrl,
          );

          xhr.withCredentials = true;

          // -----------------------------------------
          // PROGRESS
          // -----------------------------------------

          xhr.upload.addEventListener(
            "progress",
            (event) => {
              if (
                event.lengthComputable
              ) {
                const percent =
                  Math.round(
                    (event.loaded /
                      event.total) *
                      100,
                  );

                setItemProgress(
                  tempId,
                  percent,
                );
              }
            },
          );

          // -----------------------------------------
          // SUCCESS
          // -----------------------------------------

          xhr.onload = () => {
            if (
              xhr.status >= 200 &&
              xhr.status < 300
            ) {
              resolve();
              return;
            }

            reject(
              new Error(
                `Upload failed: ${xhr.status}`,
              ),
            );
          };

          // -----------------------------------------
          // ERROR
          // -----------------------------------------

          xhr.onerror = () => {
            reject(
              new Error(
                "Network error during upload",
              ),
            );
          };

          // -----------------------------------------
          // ABORT
          // -----------------------------------------

          xhr.onabort = () => {
            reject(
              new Error(
                "Upload cancelled",
              ),
            );
          };

          // -----------------------------------------
          // SAVE XHR
          // -----------------------------------------

          setUploadXhrMap(
            (prev) => ({
              ...prev,
              [tempId]: xhr,
            }),
          );

          // -----------------------------------------
          // CONTENT TYPE
          // -----------------------------------------

          xhr.setRequestHeader(
            "Content-Type",
            upload.contentType ||
              file.type ||
              "application/octet-stream",
          );

          // -----------------------------------------
          // START
          // -----------------------------------------

          xhr.send(file);
        },
      );
    },
    [setItemProgress],
  );

  // =================================================
  // PROCESS FOLDER
  // =================================================

  const processFolderUpload =
    useCallback(
      async (
        files,
        queueItems,
      ) => {
        showError('')
        if (!files.length) {
          isUploadingRef.current =
            false;

          setIsUploading(false);

          onQueueComplete?.();

          return;
        }

        try {
          // =========================================
          // STORAGE CHECK
          // =========================================

          const totalSize =
            files.reduce(
              (total, file) =>
                total + file.size,
              0,
            );

          const storageLeft =
            user.totalStorage -
            user.totalUsage;

          if (
            totalSize >
            storageLeft
          ) {
            const needed =
              totalSize -
              storageLeft;

            showError(
              `Storage is full. You need ${formatSize(
                needed,
              )} more storage`,
            );

            await refreshUser();

            return;
          }

          // =========================================
          // INITIALIZE FOLDER
          // =========================================

          const response =
            await initiateFolderUpload({
              parentDirId: dirId,

              files: files.map(
                (file) => ({
                  name: file.name,

                  size: file.size,

                  contentType:
                    file.type ||
                    "application/octet-stream",

                  relativePath:
                    file.webkitRelativePath ||
                    file.name,
                }),
              ),
            });

          const uploadFiles =
            response.files;

          // =========================================
          // UPLOAD EACH FILE
          // =========================================

          for (
            let index = 0;
            index < uploadFiles.length;
            index++
          ) {
            const upload =
              uploadFiles[index];

            const originalFile =
              files[upload.index];

            const queueItem =
              queueItems.find(
                (item) =>
                  item.index ===
                  upload.index,
              );

            if (!queueItem) {
              continue;
            }

            try {
              // -------------------------------------
              // UPLOAD TO S3
              // -------------------------------------

              await uploadSingleFile(
                originalFile,
                upload,
                queueItem._id,
              );

              // -------------------------------------
              // COMPLETE BACKEND UPLOAD
              // -------------------------------------

           await completeFolderUpload(upload.fileId);

              // -------------------------------------
              // 100%
              // -------------------------------------

              setItemProgress(
                queueItem._id,
                100,
              );

              // -------------------------------------
              // REFRESH STORAGE
              // -------------------------------------

              await refreshUser();

            } catch (error) {
              console.error(
                "Folder file upload failed:",
                error,
              );

              showError(
                error.message ||
                  `Failed to upload ${originalFile.name}`,
              );

              await handleCancelUpload(
                queueItem._id,
                upload.fileId,
              );
            }
          }

          // =========================================
          // DONE
          // =========================================

          setUploadQueue([]);

          setProgressMap({});

          setUploadXhrMap({});

          isUploadingRef.current =
            false;

          setIsUploading(false);

          await refreshUser();

          onQueueComplete?.();

        } catch (error) {
          console.error(
            "Folder upload failed:",
            error,
          );

          showError(
            error.message ||
              "Failed to upload folder",
          );

          isUploadingRef.current =
            false;

          setIsUploading(false);
        }
      },
      [
        dirId,
        user,
        refreshUser,
        showError,
        handleCancelUpload,
        setItemProgress,
        uploadSingleFile,
        onQueueComplete,
      ],
    );

  // =================================================
  // SELECT FOLDER
  // =================================================

  const handleFolderSelect =
    useCallback(
      (event) => {
        showError("");

        // -------------------------------------------
        // UPLOADS PAUSED
        // -------------------------------------------

        if (
          user.uploadLimit !== null &&
          user.uploadLimit === 0
        ) {
          showError(
            "Uploads are paused. Please complete your payment to continue",
          );

          event.target.value = "";

          return;
        }

        // -------------------------------------------
        // SELECTED FILES
        // -------------------------------------------

        const selected =
          Array.from(
            event.target.files || [],
          );

        if (!selected.length) {
          return;
        }

        // -------------------------------------------
        // SIZE VALIDATION
        // -------------------------------------------

        const validFiles =
          selected.filter(
            (file) =>
              file.size <=
              user.uploadLimit,
          );

        if (!validFiles.length) {
          showError(
            "No files can be uploaded because they exceed the upload limit",
          );

          event.target.value = "";

          return;
        }

        if (
          validFiles.length !==
          selected.length
        ) {
          showError(
            "Some files were skipped because they exceed the upload limit",
          );
        }

        // -------------------------------------------
        // CREATE TRAY ITEMS
        // -------------------------------------------

        const newItems =
          validFiles.map(
            (file, index) => ({
              file,

              name:
                file.webkitRelativePath ||
                file.name,

              size: file.size,

              index,

              _id:
                `folder-${Date.now()}-${Math.random()}-${index}`,

              isUploading: true,
            }),
          );

        setUploadQueue(
          newItems,
        );

        setProgressMap(
          Object.fromEntries(
            newItems.map(
              (item) => [
                item._id,
                0,
              ],
            ),
          ),
        );

        // -------------------------------------------
        // RESET INPUT
        // -------------------------------------------

        event.target.value = "";

        // -------------------------------------------
        // START
        // -------------------------------------------

        if (
          !isUploadingRef.current
        ) {
          isUploadingRef.current =
            true;

          setIsUploading(true);

          processFolderUpload(
            validFiles,
            newItems,
          );
        }
      },
      [
        user,
        showError,
        processFolderUpload,
      ],
    );

  // =================================================
  // RETURN
  // =================================================

  return {
    fileInputRef,

    uploadQueue,

    progressMap,

    isUploading,

    dbFileId,
    setDbFileId,

    handleFolderSelect,

    handleCancelUpload,

    enqueueItem,

    setItemProgress,

    completeItem,
  };
}