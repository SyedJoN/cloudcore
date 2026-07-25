import { useState, useCallback, useMemo } from "react";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { getDirectory } from "../../apis/directoryApi";
import { driveConfig } from "../../Utils/driveConfig";

const isRootName = (n) => (n ?? "").startsWith("root");

export function useDirectoryData({
  route,
  dirId,
  dirContext,
  isSharedRoute,
  isTrashRoute,
  isGoogleDrive,
  setIsGoogleDrive,
  navigate,
  searchQuery,
}) {
  const [directoryName, setDirectoryName] = useState("My Drive");
  const [directoriesList, setDirectoriesList] = useState([]);
  const [filesList, setFilesList] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsAccess, setNeedsAccess] = useState(false);

  const getDirectoryItems = useCallback(
    async (dirType) => {
      setIsLoading(true);

      if (!driveConfig[dirType]) {
        console.log("Invalid Directory Type");
        return;
      }

      try {
        const { fetch } = driveConfig[dirType];

        const { data } = await fetch(dirId || "");

        const name =
          isSharedRoute && !dirId
            ? "Shared with me"
            : dirId === "google-drive"
              ? "Google Drive"
              : data.name;

        setDirectoryName(name);

        const cleanPath = Array.isArray(data?.path)
          ? data?.path
              .filter((p) => !isRootName(p.name))
              .map((p) => ({ id: p._id, name: p.name }))
          : (data?.path ?? []);
        const currentCrumb = data?.path
          ? isRootName(data?.name)
            ? {}
            : { id: data?._id, name: data?.name }
          : {};
        setCrumbs([...cleanPath, currentCrumb]);

        if (!data?.directories || !data?.files) return;

        setIsDeleted(
          data.directories.some((d) => d.isDeleted) ||
            data.files.some((f) => f.isDeleted),
        );

        setDirectoriesList([...data.directories].reverse());
        setFilesList([...data.files].reverse());
      } catch (err) {
        if (isGoogleDrive) setIsGoogleDrive(false);

        const status = err?.response?.status;
        if (status === 403) {
          setNeedsAccess(true);
        } else if (status === 401 || status === 404) {
          navigate("/login");
        } else {
          console.error(err);
          navigate("/");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      dirId,
      dirContext,
      isSharedRoute,
      isGoogleDrive,
      setIsGoogleDrive,
      navigate,
    ],
  );

  const getTrashItems = useCallback(
    async (showError, tab = "") => {
      setIsLoading(true);
      try {
        const { data } = await axiosWithCreds.get(
          `/trash/${tab === "trash" ? dirId : ""}`,
        );

        setDirectoryName(isTrashRoute ? "Trash" : data.name);
        showError?.("");

        if (!data.directories || !data.files) return;

        setDirectoriesList([...data.directories].reverse());
        setFilesList([...data.files].reverse());
      } catch (err) {
        if (err?.response?.status === 403) {
          showError?.(err.message);
          return;
        }
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [dirId, isTrashRoute],
  );

  const combinedItems = useMemo(
    () => [
      ...directoriesList.map((d) => ({ ...d, isDirectory: true })),
      ...filesList.map((f) => ({ ...f, isDirectory: false })),
    ],
    [directoriesList, filesList],
  );

  const q = searchQuery.trim().toLowerCase();

  const filteredDirs = useMemo(
    () =>
      combinedItems.filter(
        (i) => i.isDirectory && (!q || i.name?.toLowerCase().includes(q)),
      ),
    [combinedItems, q],
  );

  const filteredFiles = useMemo(
    () =>
      combinedItems.filter(
        (i) => !i.isDirectory && (!q || i.name?.toLowerCase().includes(q)),
      ),
    [combinedItems, q],
  );

  return {
    directoryName,
    directoriesList,
    filesList,
    setFilesList,
    setDirectoriesList,
    crumbs,
    setCrumbs,
    isDeleted,
    isLoading,
    needsAccess,
    getDirectoryItems,
    getTrashItems,
    combinedItems,
    filteredDirs,
    filteredFiles,
  };
}
