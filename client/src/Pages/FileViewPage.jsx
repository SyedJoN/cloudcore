import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FileViewer from "../Components/File/FileViewer";
import {
  getFileByMetaId,
  toggleFilePublic,
  grantAccessById,
  revokeFileAccess,
} from "../../apis/fileApi";
import ShareModal from "../Components/Modals/ShareModal";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { useRef } from "react";
import { useAuth, useGDrive, useToast } from "../Contexts";
import { searchUsers } from "../../apis/userApi";
import { useDirectoryData } from "../Hooks/useDirectoryData";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";
import { getResourceType } from "../../Utils/getResourceType";
import { DRIVE_ROLES } from "../../Utils/displayUtils";
import { updateItemState } from "../../Utils/updateItemState";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function FileViewPage() {
  const { user, setUser, refreshUser } = useAuth();
  const { dirId } = useParams();
  const { checkGoogleDriveAccess, isGoogleDrive, setIsGoogleDrive } =
    useGDrive();
  const { toast } = useToast();
  const { fileId } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const [shareItem, setShareItem] = useState(null);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameType, setRenameType] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [peopleWithAccess, setPeopleWithAccess] = useState([]);
  const [directoriesList, setDirectoriesList] = useState([]);
  const [filesList, setFilesList] = useState([]);
  const [prevPermissions, setPrevPermissions] = useState([]);
  const [linkAccess, setLinkAccess] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const usersLoadedRef = useRef(null);
  const navigate = useNavigate();
  const extRef = useRef(null);


  function openRename(item) {
    setRenameType(item.isDirectory ? "directory" : "file");
    setRenameId(item._id);
    extRef.current = item.extension;
    setRenameValue(item.name);
    setShowRename(true);
  }

  async function handleRenameSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const url =
        renameType === "file" ? `/file/${renameId}` : `/directory/${renameId}`;

      const body =
        renameType === "file"
          ? { fileName: renameValue }
          : { newDirName: renameValue };

      await axiosWithCreds.patch(url, body);
      const cleanName = renameValue.replace(/\.[^/.]+$/, "");
      const newName = `${cleanName}${extRef.current}`;
      setShowRename(false);
      setItem((prev) => ({ ...prev, name: newName }));
    } catch (err) {
      setError(err.message);
    }
  }

const handleToggleResourcePublic = async (
  item,
  role,
  access,
) => {
  setIsShareLoading(true);

  try {
    const itemId = item._id ?? item.id;
    const type = getResourceType(item);
    const isGoogleDrive = type.startsWith(
      "google-drive",
    );

    const restricted = access === "restricted";
    const userRole =
      DRIVE_ROLES[role] ?? "reader";

    let permission = null;

    if (isGoogleDrive) {
      if (restricted) {
        await revokeFileAccess(
          "google",
          itemId,
        );
      } else {
        const { data } =
          await toggleDriveFilePermission(
            itemId,
            userRole,
          );

        permission = data.permission;
      }
    } else {
      await toggleFilePublic(
        itemId,
        userRole,
        access,
        type,
      );
    }

    const permissions =
      item.permissions ?? [];

    const updatedPermissions = restricted
      ? permissions.filter(
          (p) => p?.type !== "anyone",
        )
      : [
          ...permissions.filter(
            (p) => p?.type !== "anyone",
          ),
          {
            ...(permission ?? {}),
            type: "anyone",
            role: userRole,
          },
        ];


    const update = (list) =>
      list.map((resource) => {
        if (
          String(
            resource._id ?? resource.id,
          ) !== String(itemId)
        ) {
          return resource;
        }

        return {
          ...resource,
          permissions: updatedPermissions,
          isPublic: !restricted,
          publicRole: restricted
            ? undefined
            : userRole,
        };
      });

    updateItemState(setItem, itemId, {
      permissions: updatedPermissions,
      isPublic: !restricted,
      publicRole: restricted
        ? undefined
        : userRole,
    });


    setLinkAccess(
      restricted ? "restricted" : "anyone",
    );

    setLinkRole(
      restricted ? "reader" : userRole,
    );

    toast({
      message: "Public Access updated",
      type: "success",
    });
  } catch (error) {
    toast({
      message:
        error?.message ||
        "Something went wrong!",
      type: "error",
    });
  } finally {
    setIsShareLoading(false);
  }
};


const handleSharedRoleUpdate = async (
  item,
  type,
  message,
) => {
  setIsShareLoading(true);

  try {
    const result = await updateSharedAccess({
      item,
      type,
      peopleWithAccess,
      prevPermissions,
      message,
      grantAccessById,
      revokeFileAccess,
    });

    if (!result.changed) {
      setShareItem(null);
      return;
    }

    const itemId = String(
      item._id ?? item.id,
    );

  


    setItem((currentItem) => {
      if (!currentItem) {
        return currentItem;
      }

      if (
        String(currentItem._id) !== itemId
      ) {
        return currentItem;
      }

      const nonUserPermissions = (
        currentItem.permissions ?? []
      ).filter(
        (permission) =>
          permission.type !== "user",
      );

      return {
        ...currentItem,
        permissions: [
          ...nonUserPermissions,
          ...result.permissions,
        ],
      };
    });

    setPeopleWithAccess(result.permissions);
    setPrevPermissions(result.permissions);
    setShareItem(null);

    toast({
      message: "Access updated",
      type: "success",
    });
  } catch (error) {
    toast({
      message:
        error?.message ||
        "Something went wrong!",
      type: "error",
    });
  } finally {
    setIsShareLoading(false);
  }
};



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
      console.log("filedata", data);

      setItem(data);
    } catch (error) {
      setError(error.message || "Failed to load file");
      console.log(error);
    }
  };

  useEffect(()=> {
    console.log('item', item)
  }, [shareItem])
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

  if (!item)
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

  const handleShareItem = async (item, role, access) => {
    try {
      setIsShareLoading(true);
      const { _id } = item;
      const result = await toggleFilePublic(_id, role, access);
      console.log(result);
    } catch (error) {
      throw new Error(error || "Something went wrong!");
    } finally {
      setIsShareLoading(false);
    }
  };

  async function handleMoveToTrash(item) {
    console.log("item", item);
    try {
      const url = item.isDirectory
        ? `/directory/soft-delete/${item._id}`
        : `/file/soft-delete/${item._id}`;
      const channel = new BroadcastChannel("file-sync");

      await axiosWithCreds.delete(url);

      channel.postMessage({
        type: "FILE_DELETED",
        id: item._id,
      });
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  }

  return (
    <>
      <FileViewer
        key={item._id}
        isStarred={isStarred}
        shareItem={shareItem}
        item={item}
        onClose={() => window.close()}
        meta={true}
        isGDrive={false}
        onRename={(item) => {
          openRename(item);
        }}
        onShare={(item) => setShareItem(item)}
        onSoftDelete={(item) => handleMoveToTrash(item)}
        onDownload={() =>
          window.open(`${BASE_URL}/file/${item._id}?action=download`, "_blank")
        }
      />
      {shareItem && (
        <ShareModal
          item={shareItem}
          setItem={setItem}
          onClose={handleToggleResourcePublic}
          onUpdateRoleAfterSave={handleSharedRoleUpdate}
          setShareItem={setShareItem}
          isShareLoading={isShareLoading}
          setIsShareLoading={setIsShareLoading}
          setDirectoriesList={setDirectoriesList}
          setFilesList={setFilesList}
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
      )}
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
