import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import FileViewer from "../Components/File/FileViewer";
import FileViewerMobile from "../Components/File/FileViewerMobile";
import {
  getFileByMetaId,
  toggleFilePublic,
  grantAccessById,
  revokeFileAccess,
} from "../../apis/fileApi";
import ShareModal from "../Components/Modals/ShareModal";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { useAuth, useGDrive, useToast } from "../Contexts";
import { searchUsers } from "../../apis/userApi";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";
import { getResourceType } from "../../Utils/getResourceType";
import { DRIVE_ROLES } from "../../Utils/displayUtils";
import { toggleItemStar } from "../../apis/resourceApi";
import ShareModalMobile from "../Components/Modals/ShareModalMobile";
import useDriveActions from "../Hooks/useDriveActions";
import { useDirectoryData } from "../Hooks/useDirectoryData";
import ConfirmationModal from "../Components/Modals/ConfirmationModal";
import CascadeConfirmationModal from "../Components/Modals/CascadeConfirmationModal";
import { useDevice } from "../Contexts/DeviceContext";
import { useSelectionAndContextMenu } from "../Hooks/useSelectionAndContextMenu";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function FileViewPage({ route = null }) {
  const { user, refreshUser } = useAuth();

  const { isGoogleDrive, setIsGoogleDrive } = useGDrive();
  const location = useLocation();
  const { toast } = useToast();
  const { dirId, fileId } = useParams();
  const { device } = useDevice();
  const isMobile = device === "mobile";
  const isHomeRoute = location.pathname === "/home";
  const isSharedRoute = location.pathname === "/shared";
  const isTrashRoute = location.pathname === "/trash";
  const isGoogleDriveRoute =
    location.pathname === "/google-drive" && isGoogleDrive;
  const isRecentRoute = location.pathname === "/recent";
  const isStarredRoute = location.pathname === "/starred";

  const dirContext =
    location.state?.dirContext ||
    (isTrashRoute
      ? "trash"
      : isSharedRoute
        ? "shared"
        : isRecentRoute
          ? "recent"
          : isGoogleDriveRoute
            ? "google-drive"
            : isHomeRoute
              ? "home"
              : isStarredRoute
                ? "starred"
                : "root");
  const [item, setItem] = useState([]);
  const [error, setError] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameType, setRenameType] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isStarred, setIsStarred] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [restartAnimation, setRestartAnimation] = useState(false);

  const usersLoadedRef = useRef(null);
  const previousDirContext = useRef(null);
  const errorTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const mainRef = useRef(null);

  useEffect(() => {
    setIsStarred((prev) => {
      const updated = { ...prev };
      item?.forEach((i) => {
        updated[i._id] = i.isStarred;
      });
      return updated;
    });
  }, [item]);

  function showError(message, autoClear = false) {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => setError(""), 5000);
    }
  }

  const {
    setFilesList,
    setDirectoriesList,
    lastDirectory,
    setLastDirectory,
    combinedItems,
  } = useDirectoryData({
    dirId,
    dirContext,
    isSharedRoute,
    isRecentRoute,
    isTrashRoute,
    setIsStarred,
    isStarred,
    isGoogleDriveRoute,
    setIsGoogleDrive,
    navigate,
    searchQuery,
  });

  const { selectedItems, setContextItem, handleSelect, clearSelection } =
    useSelectionAndContextMenu({ combinedItems, mainRef, lastDirectory });

  const {
    isShareLoading,
    setIsShareLoading,
    handlePrint,
    handleDownload,
    handleMoveToTrash,
    openRename,
    handleCascadeConfirm,
    handleCascadeCancel,
    handleRenameSubmit,
    handleToggleStar,
    handleToggleResourcePublic,
    handleSharedRoleUpdate,
    handleConfirm,
    handleCancel,
    showRename,
    setShowRename,
    renameValue,
    setRenameValue,
    shareItem,
    setShareItem,
    prevPermissions,
    setPrevPermissions,
    peopleWithAccess,
    setPeopleWithAccess,
    linkRole,
    setLinkRole,
    linkAccess,
    viewItem,
    setUserRole,
    setViewItem,
    setLinkAccess,
    cascadeModal,
    confirmModal,
  } = useDriveActions({
    dirId,
    user,
    item,
    setItem,
    setDirectoriesList,
    setFilesList,
    combinedItems,
    lastDirectory,
    setLastDirectory,
    isGoogleDriveRoute,
    selectedItems,
    isMobile,
    setContextItem,
    restartAnimation,
    isStarred,
    isStarredRoute,
    isTrashRoute,
    setIsStarred,
    handleSelect,
    refreshUser,
    previousDirContext,
    clearSelection,
    toast,
    setError,
    showError,
  });

  // function openRename(item) {
  //   setRenameType(item.isDirectory ? "directory" : "file");
  //   setRenameId(item._id);
  //   extRef.current = item.extension;
  //   setRenameValue(item.name);
  //   setShowRename(true);
  // }

  // async function handleRenameSubmit(e) {
  //   e.preventDefault();
  //   setError("");
  //   try {
  //     const url =
  //       renameType === "file" ? `/file/${renameId}` : `/directory/${renameId}`;

  //     const body =
  //       renameType === "file"
  //         ? { fileName: renameValue }
  //         : { newDirName: renameValue };

  //     await axiosWithCreds.patch(url, body);
  //     const cleanName = renameValue.replace(/\.[^/.]+$/, "");
  //     const newName = `${cleanName}${extRef.current}`;
  //     setShowRename(false);
  //     setItem((prev) => prev.map((prev) => ({ ...prev, name: newName })));
  //   } catch (err) {
  //     setError(err.message);
  //   }
  // }

  // const handleToggleResourcePublic = async (item, role, access) => {
  //   setIsShareLoading(true);

  //   try {
  //     const itemId = item._id ?? item.id;
  //     const type = getResourceType(item);

  //     const restricted = access === "restricted";
  //     const userRole = DRIVE_ROLES[role] ?? "reader";

  //     let permission = null;

  //     await toggleFilePublic(itemId, userRole, access, type);

  //     const update = (list) =>
  //       list.map((resource) => {
  //         if (String(resource._id ?? resource.id) !== String(itemId)) {
  //           return resource;
  //         }

  //         const permissions = resource.permissions ?? [];

  //         const updatedPermissions = restricted
  //           ? permissions.filter((p) => p?.type !== "anyone")
  //           : [
  //               ...permissions.filter((p) => p?.type !== "anyone"),
  //               {
  //                 ...(permission ?? {}),
  //                 type: "anyone",
  //                 role: userRole,
  //               },
  //             ];

  //         return {
  //           ...resource,
  //           isPublic: restricted ? false : true,
  //           publicRole: restricted ? null : userRole,
  //           permissions: updatedPermissions,
  //         };
  //       });

  //     setItem((prev) => update(prev));
  //     setLinkAccess(restricted ? "restricted" : "anyone");
  //     setLinkRole(restricted ? "reader" : userRole);

  //     toast({
  //       message: "Public Access updated",
  //       type: "success",
  //     });
  //   } catch (error) {
  //     toast({
  //       message: error?.message || "Something went wrong!",
  //       type: "error",
  //     });
  //   } finally {
  //     setIsShareLoading(false);
  //   }
  // };

  // const handleSharedRoleUpdate = async (item, type, message) => {
  //   setIsShareLoading(true);

  //   try {
  //     const allPermissions = item?.permissions ?? [];
  //     const mergedPermissions = allPermissions.map((permission) => {
  //       const changedPermission = peopleWithAccess.find(
  //         (person) => String(person.id) === String(permission.id),
  //       );

  //       if (!changedPermission) {
  //         return permission;
  //       }

  //       return {
  //         ...permission,
  //         role: changedPermission.role,
  //       };
  //     });
  //     const newPermissions = mergedPermissions.filter(
  //       (permission) =>
  //         permission?.type !== "anyone" && permission?.role !== "owner",
  //     );

  //     const previousEditablePermissions = (item?.permissions ?? []).filter(
  //       (permission) =>
  //         permission?.type !== "anyone" && permission?.role !== "owner",
  //     );

  //     const result = await updateSharedAccess({
  //       item,
  //       type,
  //       peopleWithAccess: newPermissions,
  //       prevPermissions: previousEditablePermissions,
  //       message,
  //       grantAccessById,
  //       revokeFileAccess,
  //     });

  //     if (!result.changed) {
  //       setShareItem(null);
  //       return;
  //     }

  //     const updatedPeopleWithAccess = peopleWithAccess
  //       .map((p) => {
  //         const isRemoved = p.role === "remove";
  //         if (isRemoved) {
  //           return null;
  //         }
  //         return p;
  //       })
  //       .filter(Boolean);

  //     const update = (list) =>
  //       list.map((resource) => {
  //         const resourceId = String(resource?._id ?? resource?.id);
  //         if (resourceId !== String(result.itemId)) {
  //           return resource;
  //         }
  //         return {
  //           ...resource,
  //           permissions: updatedPeopleWithAccess,
  //         };
  //       });
  //     setItem((prev) => update(prev));
  //     setPeopleWithAccess(updatedPeopleWithAccess);
  //     setPrevPermissions(updatedPeopleWithAccess);
  //     setShareItem(null);

  //     toast({
  //       message: "Access updated",
  //       type: "success",
  //     });
  //   } catch (error) {
  //     toast({
  //       message: error?.message || "Something went wrong!",
  //       type: "error",
  //     });
  //   } finally {
  //     setIsShareLoading(false);
  //   }
  // };

  useEffect(() => {
    refreshUser();
  }, []);

  async function getFile() {
    await getFileById(fileId);
  }
  useEffect(() => {
    getFile();
  }, [fileId]);

  useEffect(() => {
    async function loadAllUsers() {
      if (usersLoadedRef.current) return;
      usersLoadedRef.current = true;
      try {
        const data = await searchUsers(user.id);
        setAllUsers(
          data.users.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.avatar,
          })),
        );
      } catch (err) {
        console.log(err.message);
      }
    }
    loadAllUsers();
  }, [fileId]);

  const getFileById = async (fileId) => {
    try {
      const data = await getFileByMetaId(fileId);
      setItem([data]);
      setViewItem([data]);
    } catch (error) {
      setError(error.message || "Failed to load file");
      console.log(error);
    }
  };

  if (error)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2>Cannot open file</h2>
        <p style={{ color: "#5f6368" }}>{error}</p>
      </div>
    );

  if (!item) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <div className="fv-spinner" />
      </div>
    );
  }

  // async function handleToggleStar(item) {
  //   try {
  //     await Promise.all(
  //       item.map((i) => {
  //         const type = i.isDirectory ? "folder" : "file";
  //         setIsStarred((prev) => ({
  //           ...prev,
  //           [i._id]: !prev[i._id],
  //         }));
  //         return toggleItemStar(i._id, type);
  //       }),
  //     );
  //     setItem((prev) => prev.map((i) => ({ ...i, isStarred: !i.isStarred })));

  //     toast({
  //       message: `${item[0].name} ${item[0].isStarred ? "removed from" : "added to"} starred`,
  //       type: "success",
  //     });
  //   } catch (error) {
  //     setError(error.message);
  //   }
  // }

  // async function handleMoveToTrash(item) {
  //   try {
  //     const url = item.isDirectory
  //       ? `/directory/soft-delete/${item._id}`
  //       : `/file/soft-delete/${item._id}`;
  //     const channel = new BroadcastChannel("file-sync");

  //     await axiosWithCreds.delete(url);

  //     channel.postMessage({
  //       type: "FILE_DELETED",
  //       id: item._id,
  //     });
  //   } catch (err) {
  //     setError(err.message || "Something went wrong");
  //   }
  // }

  // tab band na ho sake (mobile browser me direct open) to drive pe wapas
  const closeViewer = () => {
    window.close();
    setTimeout(() => navigate("/drive"), 150);
  };

  const handleShare =
    route === "direct"
      ? () => setShareItem(item[0])
      : (item) => setShareItem(item);

  // const handleDownload = () =>
  //   window.open(`${BASE_URL}/file/${item[0]._id}?action=download`, "_blank");

  return (
    <>
      {cascadeModal && (
        <CascadeConfirmationModal
          chain={cascadeModal.chain}
          onCancel={handleCascadeCancel}
          onConfirm={handleCascadeConfirm}
          isFetching={isShareLoading}
        />
      )}
      {confirmModal.open && (
        <ConfirmationModal
          open={confirmModal.open}
          title={confirmModal.message}
          action_1="Yes"
          action_2="No"
          onAction_1={handleConfirm}
          onAction_2={handleCancel}
        />
      )}
      {isMobile ? (
        <FileViewerMobile
          key={item.map((it) => it?._id)}
          item={item}
          meta={true}
          onPrint={handlePrint}
          isStarred={isStarred}
          onClose={closeViewer}
          onRename={openRename}
          onShare={handleShare}
          onTrash={() => handleMoveToTrash(item[0])}
          onStar={() => handleToggleStar(item)}
          onDownload={handleDownload}
          onDeleteSuccess={() => {
            console.log("on delete success");
          }}
        />
      ) : (
        <FileViewer
          key={item.map((it) => it?._id)}
          item={item}
          isStarred={isStarred}
          shareItem={shareItem}
          onClose={() => window.close()}
          meta={true}
          isGDrive={false}
          onRename={openRename}
          onShare={handleShare}
          onPrint={handlePrint}
          onTrash={() => handleMoveToTrash(item[0])}
          onStar={() => handleToggleStar(item)}
          onDownload={handleDownload}
        />
      )}

      {shareItem &&
        (isMobile ? (
          <ShareModalMobile
            item={shareItem}
            setItem={setItem}
            setDirectoriesList={setDirectoriesList}
            setFilesList={setFilesList}
            setUserRole={setUserRole}
            setViewItem={setItem}
            onClose={handleToggleResourcePublic}
            onUpdateRoleAfterSave={handleSharedRoleUpdate}
            setShareItem={setShareItem}
            isShareLoading={isShareLoading}
            setIsShareLoading={setIsShareLoading}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
            peopleWithAccess={peopleWithAccess}
            prevPermissions={prevPermissions}
            setPrevPermissions={setPrevPermissions}
            linkAccess={linkAccess}
            setLinkAccess={setLinkAccess}
            linkRole={linkRole}
            setLinkRole={setLinkRole}
            setPeopleWithAccess={setPeopleWithAccess}
            allUsers={allUsers}
            setAllUsers={setAllUsers}
          />
        ) : (
          <ShareModal
            item={shareItem}
            setItem={setItem}
            setDirectoriesList={setDirectoriesList}
            setFilesList={setFilesList}
            setUserRole={setUserRole}
            setViewItem={setItem}
            onClose={handleToggleResourcePublic}
            onUpdateRoleAfterSave={handleSharedRoleUpdate}
            setShareItem={setShareItem}
            isShareLoading={isShareLoading}
            setIsShareLoading={setIsShareLoading}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
            peopleWithAccess={peopleWithAccess}
            prevPermissions={prevPermissions}
            setPrevPermissions={setPrevPermissions}
            linkAccess={linkAccess}
            setLinkAccess={setLinkAccess}
            linkRole={linkRole}
            setLinkRole={setLinkRole}
            setPeopleWithAccess={setPeopleWithAccess}
            allUsers={allUsers}
            setAllUsers={setAllUsers}
          />
        ))}
      {showRename && (
        <div className="gd-modal-overlay" onClick={() => setShowRename(false)}>
          <div className="gd-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Rename</h2>
            <form onSubmit={handleRenameSubmit}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <div className="gd-modal-actions">
                <button
                  type="button"
                  className="gd-btn gd-btn-text"
                  onClick={() => setShowRename(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gd-btn gd-btn-primary">
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
