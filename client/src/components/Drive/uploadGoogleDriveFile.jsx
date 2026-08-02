import {
  getSignedUploadUrl,
  notifyBackend,
  uploadDriveFileToS3,
} from "../../../apis/fileApi";

export async function uploadGoogleDriveFile(
  pickedFile,
  {
    enqueueItem,
    setItemProgress,
    completeItem,
    handleCancelUpload,
    setDbFileId,
    onUploadComplete,
    refreshUser,
  },
) {
  const { id, name, size, contentType, dirId } = pickedFile;
  enqueueItem({ _id: id, name, size });

  let S3fileId;
  try {
    const signed = await getSignedUploadUrl({
      name,
      size,
      contentType,
      parentDirId: dirId,
      type: "google",
    });
    S3fileId = signed.fileId;
    setDbFileId(S3fileId);

    const response = await uploadDriveFileToS3(S3fileId, id);
    const bytes = new Uint8Array(response.data.buffer.data);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.uploadUrl);
      xhr.withCredentials = true;

      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          setItemProgress(id, (evt.loaded / evt.total) * 100);
        }
      });

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          await notifyBackend(S3fileId);
          await refreshUser();
          completeItem(id);
          onUploadComplete?.();
          resolve();
        } else {
          console.error("Upload failed:", xhr.status, xhr.responseText);
          await handleCancelUpload(id, fileId);
          reject(new Error("Upload failed"));
        }
      };

      xhr.addEventListener("error", async () => {
        console.error("Network error during upload");
        await handleCancelUpload(id, S3fileId);
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        console.warn("Upload aborted");
        reject(new Error("Upload aborted"));
      });

      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(bytes);
    });
    return { dirId };
  } catch (error) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      throw error;
    }
    console.error("Drive upload error:", error);
    await handleCancelUpload(id, S3fileId);
    throw error;
  }
}
