import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { axiosWithCreds } from "../../apis/axiosInstances";
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
  const [lastDirectory, setLastDirectory] = useState([]);
  const [filesList, setFilesList] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsAccess, setNeedsAccess] = useState(false);

  const controllerRef = useRef(null);

  const startRequest = () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const getDirectoryItems = useCallback(
    async (dirType) => {
      if (!ROUTE_CONFIG[dirType]) {
        console.log("Invalid Directory Type");
        return;
      }

      const signal = startRequest();
      setIsLoading(true);
      setDirectoriesList([]);
      setFilesList([]);

      try {
        const { fetch } = ROUTE_CONFIG[dirType];

        const { data } = await fetch(dirId || "", { signal });
        if (isRootName(data?.name)) {
          setLastDirectory(null);
        } else {
          setLastDirectory({ ...data, isDirectory: true });
        }
        const name =
          isSharedRoute && !dirId
            ? ROUTE_CONFIG["shared"].label
            : route === "google-drive"
              ? ROUTE_CONFIG[route].label
              : route === "starred"
                ? ROUTE_CONFIG[route].label
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

        if (!isRecentRoute) {
          setDirectoriesList([...data.directories].reverse());
        }
        setFilesList([...data.files].reverse());
      } catch (err) {
        if (axios.isCancel(err) || signal.aborted) return;

        if (isGoogleDrive) setIsGoogleDrive(false);

        const status = err?.response?.status;
        if (status === 403) {
          setNeedsAccess(true);
        } else if (status === 401 || status === 404) {
          navigate("/login");
        } else {
          console.log(err);
          navigate("/drive");
        }
      } finally {
        // sirf latest request loading band kare
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [
      dirId,
      dirContext,
      route,
      isSharedRoute,
      isRecentRoute,
      isGoogleDriveRoute,
      isGoogleDrive,
      setIsGoogleDrive,
      navigate,
    ],
  );

  const getTrashItems = useCallback(
    async (showError, tab = "") => {
      const signal = startRequest();
      setIsLoading(true);
      setDirectoriesList([]);
      setFilesList([]);

      try {
        const { data } = await axiosWithCreds.get(
          `/trash/${tab === "trash" ? dirId : ""}`,
          { signal },
        );

        setDirectoryName(isTrashRoute ? "Trash" : data.name);
        showError?.("");

        if (!data.directories || !data.files) return;

        setDirectoriesList([...data.directories].reverse());
        setFilesList([...data.files].reverse());
      } catch (err) {
        if (axios.isCancel(err) || signal.aborted) return;

        if (err?.response?.status === 403) {
          showError?.(err.message);
          return;
        }
        console.error(err);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [dirId, isTrashRoute],
  );

  const q = searchQuery.trim().toLowerCase();

  const combinedItems = useMemo(
    () => [
      ...directoriesList
        .map((d) => ({ ...d, isDirectory: true }))
        .filter((item) => !q || item.name.toLowerCase().includes(q)),
      ...filesList
        .map((f) => ({ ...f, isDirectory: false }))
        .filter((item) => !q || item.name.toLowerCase().includes(q)),
    ],
    [directoriesList, filesList, q],
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
    lastDirectory,
    setLastDirectory,
    filesList,
    setFilesList,
    setDirectoriesList,
    crumbs,
    setCrumbs,
    isLoading,
    needsAccess,
    getDirectoryItems,
    getTrashItems,
    combinedItems,
    filteredFiles,
  };
}
