import { useState, useCallback, useMemo } from "react";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { getDirectory } from "../../apis/directoryApi";
import { useGDrive } from "../Contexts";
import { ROUTE_CONFIG } from "../../Utils/routeConfig";

const isRootName = (n) => (n ?? "").startsWith("root");

export function useDirectoryData({
  route,
  dirId,
  dirContext,
  isSharedRoute,
  isRecentRoute,
  isTrashRoute,
  isGoogleDriveRoute,
  setIsGoogleDrive,
  navigate,
  searchQuery,
}) {
  const { isGoogleDrive } = useGDrive();
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
      if (!ROUTE_CONFIG[dirType]) {
        console.log("Invalid Directory Type");
        return;
      }

      try {
        const { fetch } = ROUTE_CONFIG[dirType];

        const { data } = await fetch(dirId || "");

        const name =
          isSharedRoute && !dirId
            ? ROUTE_CONFIG["shared"].label
            : route === "google-drive"
              ? ROUTE_CONFIG[route].label :
              route === "starred" ? ROUTE_CONFIG[route].label
              : data?.name;

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

        if (!isRecentRoute ? !data?.directories || !data?.files : !data?.files)
          return;

        if (isGoogleDrive && isGoogleDriveRoute) {
          const directories = data.directories?.map((directory) => {
            const publicPermission = directory.permissions?.find(
              (p) => p.type === "anyone" && p.allowFileDiscovery === false,
            );

            return {
              ...directory,
              isPublic: !!publicPermission,
              publicRole: publicPermission?.role || null,
            };
          });

          const files = data.files?.map((file) => {
            const publicPermission = file.permissions?.find(
              (p) => p.type === "anyone" && p.allowFileDiscovery === false,
            );

            return {
              ...file,
              isPublic: !!publicPermission,
              publicRole: publicPermission?.role || null,
            };
          });

          setDirectoriesList(directories);
          setFilesList(files);
          return;
        }
        setIsDeleted(
          !isRecentRoute
            ? data.directories.some((d) => d.isDeleted) ||
                data.files.some((f) => f.isDeleted)
            : data.files.some((f) => f.isDeleted),
        );
        if (!isRecentRoute) {
          setDirectoriesList([...data.directories].reverse());
        }
        setFilesList([...data.files].reverse());
      } catch (err) {
        if (isGoogleDrive) setIsGoogleDrive(false);

        const status = err?.response?.status;
        if (status === 403) {
          setNeedsAccess(true);
        } else if (status === 401 || status === 404) {
          navigate("/login");
        } else {
          console.log(err);
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
    filteredFiles,
  };
}
