import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

import { ZipArchive } from "archiver"
import { getDriveClient } from "../services/googleDriveClient.js";

export const downloadJobs = new Map();

export const FOLDER_MIME =
  "application/vnd.google-apps.folder";

export const GOOGLE_PREFIX =
  "application/vnd.google-apps.";

// =====================================================
// CREATE ZIP
// =====================================================

export const createGoogleDriveZip = async (job) => {
  const drive = getDriveClient(job.accessToken);

  let cancelled = false;

  // =================================================
  // TEMP DIRECTORY
  // =================================================

  const tempDir = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "google-drive-",
    ),
  );

  const tempZipPath = path.join(
    tempDir,
    `${crypto.randomUUID()}.zip`,
  );

  job.tempDir = tempDir;
  job.tempZipPath = tempZipPath;

  console.log(
    "Creating ZIP:",
    tempZipPath,
  );

  // =================================================
  // OUTPUT
  // =================================================

  const output = fs.createWriteStream(
    tempZipPath,
  );

  // =================================================
  // ARCHIVE
  // =================================================

  const archive = new ZipArchive({
    zlib: {
      level: 6,
    },
  });

  archive.pipe(output);

  // =================================================
  // ERROR HANDLING
  // =================================================

  archive.on("error", (error) => {
    if (!cancelled) {
      console.error(
        "ZIP error:",
        error,
      );
    }
  });

  output.on("error", (error) => {
    if (!cancelled) {
      console.error(
        "ZIP output error:",
        error,
      );
    }
  });

  // =================================================
  // CANCELLATION
  // =================================================

  const checkCancelled = () => {
    if (job.cancelled) {
      cancelled = true;
      return true;
    }

    return false;
  };

  // =================================================
  // GET ALL DOWNLOADABLE FILES
  // =================================================

  const files = [];

  const collectFiles = async (
    folderId,
    parentPath = "",
  ) => {
    if (checkCancelled()) {
      return;
    }

    let pageToken;

    do {
      if (checkCancelled()) {
        return;
      }

      const { data } =
        await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,

          fields:
            "nextPageToken,files(id,name,mimeType,size,capabilities(canDownload))",

          pageSize: 1000,

          ...(pageToken
            ? {
                pageToken,
              }
            : {}),
        });

      for (const file of data.files || []) {
        if (checkCancelled()) {
          return;
        }

        const safeName = (
          file.name ||
          "file"
        ).replace(
          /[<>:"/\\|?*\x00-\x1F]/g,
          "_",
        );

        // =========================================
        // FOLDER
        // =========================================

        if (
          file.mimeType ===
          FOLDER_MIME
        ) {
          const folderPath =
            parentPath
              ? `${parentPath}/${safeName}`
              : safeName;

          await collectFiles(
            file.id,
            folderPath,
          );

          continue;
        }

        // =========================================
        // NOT DOWNLOADABLE
        // =========================================

        if (
          file.capabilities
            ?.canDownload === false
        ) {
          continue;
        }

        const isGoogleFile =
          file.mimeType?.startsWith(
            GOOGLE_PREFIX,
          );

        // =========================================
        // SUPPORTED GOOGLE FILE
        // =========================================

        if (isGoogleFile) {
          const supported =
            [
              "application/vnd.google-apps.document",
              "application/vnd.google-apps.spreadsheet",
              "application/vnd.google-apps.presentation",
            ].includes(
              file.mimeType,
            );

          if (!supported) {
            console.log(
              "Skipping unsupported Google file:",
              file.name,
            );

            continue;
          }
        }

        // =========================================
        // ZIP PATH
        // =========================================

        files.push({
          ...file,

          zipPath: parentPath
            ? `${parentPath}/${safeName}`
            : safeName,
        });
      }

      pageToken =
        data.nextPageToken;
    } while (
      pageToken &&
      !checkCancelled()
    );
  };

  // =================================================
  // COLLECT FILES
  // =================================================

  console.log(
    "Scanning folder...",
  );

  await collectFiles(
    job.fileId,
  );

  if (checkCancelled()) {
    return;
  }

  job.total = files.length;
  job.completed = 0;
  job.progress = 0;

  console.log(
    `Found ${job.total} files`,
  );

  // Empty folder
  if (files.length === 0) {
    console.log(
      "Folder is empty",
    );

    archive.finalize();

    await new Promise(
      (resolve, reject) => {
        output.once(
          "close",
          resolve,
        );

        output.once(
          "error",
          reject,
        );
      },
    );

    job.status = "ready";
    job.progress = 100;

    return;
  }

  // =================================================
  // DOWNLOAD ONE FILE
  // =================================================

  const addFileToZip = async (
    file,
  ) => {
    if (checkCancelled()) {
      return;
    }

    let response;

    let fileName =
      file.zipPath;

    // ===============================================
    // GOOGLE WORKSPACE FILE
    // ===============================================

    if (
      file.mimeType?.startsWith(
        GOOGLE_PREFIX,
      )
    ) {
      let exportMime;
      let extension;

      switch (file.mimeType) {
        case "application/vnd.google-apps.document":
          exportMime =
            "application/pdf";

          extension = ".pdf";

          break;

        case "application/vnd.google-apps.spreadsheet":
          exportMime =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

          extension = ".xlsx";

          break;

        case "application/vnd.google-apps.presentation":
          exportMime =
            "application/pdf";

          extension = ".pdf";

          break;

        default:
          return;
      }

      response =
        await drive.files.export(
          {
            fileId: file.id,
            mimeType: exportMime,
          },
          {
            responseType:
              "stream",
          },
        );

      fileName += extension;
    }

    // ===============================================
    // NORMAL DRIVE FILE
    // ===============================================

    else {
      response =
        await drive.files.get(
          {
            fileId: file.id,
            alt: "media",
          },
          {
            responseType:
              "stream",
          },
        );
    }

    if (checkCancelled()) {
      response.data.destroy();
      return;
    }

    console.log(
      `Adding: ${fileName}`,
    );

    const stream =
      response.data;

    // ===============================================
    // APPEND TO ZIP
    // ===============================================

    await new Promise(
      (resolve, reject) => {
        let finished = false;

        const cleanup = () => {
          stream.removeListener(
            "end",
            onEnd,
          );

          stream.removeListener(
            "error",
            onError,
          );

          stream.removeListener(
            "aborted",
            onAborted,
          );
        };

        const finish = () => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          resolve();
        };

        const onEnd = () => {
          finish();
        };

        const onError = (
          error,
        ) => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          reject(error);
        };

        const onAborted = () => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          reject(
            new Error(
              "Drive stream aborted",
            ),
          );
        };

        stream.once(
          "end",
          onEnd,
        );

        stream.once(
          "error",
          onError,
        );

        stream.once(
          "aborted",
          onAborted,
        );

        archive.append(
          stream,
          {
            name: fileName,
          },
        );
      },
    );

    // ===============================================
    // PROGRESS
    // ===============================================

    job.completed++;

    job.progress =
      Math.round(
        (job.completed /
          job.total) *
          100,
      );

    console.log(
      `Progress: ${job.completed}/${job.total} (${job.progress}%)`,
    );
  };

  // =================================================
  // PROCESS CONCURRENTLY
  // =================================================

  const CONCURRENCY = 5;

  let currentIndex = 0;

  const worker = async () => {
    while (true) {
      if (checkCancelled()) {
        return;
      }

      const index =
        currentIndex++;

      if (
        index >=
        files.length
      ) {
        return;
      }

      const file =
        files[index];

      try {
        await addFileToZip(
          file,
        );
      } catch (error) {
        if (checkCancelled()) {
          return;
        }

        console.error(
          `Failed to add ${file.name}:`,
          error,
        );
      }
    }
  };

  // =================================================
  // START 5 WORKERS
  // =================================================

  console.log(
    `Starting ${CONCURRENCY} concurrent downloads...`,
  );

  const workers = Array.from(
    {
      length: Math.min(
        CONCURRENCY,
        files.length,
      ),
    },
    () => worker(),
  );

  await Promise.all(
    workers,
  );

  // =================================================
  // CANCELLED
  // =================================================

  if (checkCancelled()) {
    console.log(
      "ZIP creation cancelled",
    );

    try {
      archive.abort();
    } catch {}

    try {
      output.destroy();
    } catch {}

    return;
  }

  // =================================================
  // FINALIZE
  // =================================================

  console.log(
    "All files added. Finalizing ZIP...",
  );

  await new Promise(
    (resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        output.removeListener(
          "close",
          onClose,
        );

        output.removeListener(
          "error",
          onError,
        );

        archive.removeListener(
          "error",
          onArchiveError,
        );
      };

      const onClose = () => {
        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        resolve();
      };

      const onError = (
        error,
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        reject(error);
      };

      const onArchiveError =
        (error) => {
          if (cancelled) {
            return;
          }

          onError(error);
        };

      output.once(
        "close",
        onClose,
      );

      output.once(
        "error",
        onError,
      );

      archive.once(
        "error",
        onArchiveError,
      );

      archive.finalize();
    },
  );

  // =================================================
  // READY
  // =================================================

  if (checkCancelled()) {
    return;
  }

  job.status = "ready";
  job.progress = 100;
  job.completed =
    job.total;

  console.log(
    `ZIP ready: ${job.name}`,
  );
};