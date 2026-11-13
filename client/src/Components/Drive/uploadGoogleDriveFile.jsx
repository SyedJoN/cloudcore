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
  const { id, name: pickedName, size: pickedSize, dirId } = pickedFile;
  enqueueItem({ _id: id, name: pickedName, size: pickedSize });

  let S3fileId;
  try {
    // 1. Fetch from Drive first so we know the real name, type and size
    const response = await uploadDriveFileToS3(id);
    const { buffer, contentType, name } = response.data;
    const bytes = new Uint8Array(buffer.data);

    // 2. Create the DB record using the real values
    const signed = await getSignedUploadUrl({
      name,
      size: bytes.length,
      contentType,
      parentDirId: dirId,
      type: "google",
    });
    S3fileId = signed.fileId;
    setDbFileId(S3fileId);

    // 3. Upload to S3
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          setItemProgress(id, (evt.loaded / evt.total) * 100);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));

      xhr.send(bytes);
    });

    // 4. Finalize outside the XHR callback so errors reach the catch
    await notifyBackend(S3fileId);
    await refreshUser();
    completeItem(id);
    onUploadComplete?.("root");
    return { dirId };
  } catch (error) {
    if (S3fileId) await handleCancelUpload(id, S3fileId);
    throw error;
  }
}