import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import { toggleItemStar } from "../../apis/resourceApi";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function FileViewPage({ route = null }) {
  const { user, refreshUser } = useAuth();
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
  const [prevPermissions, setPrevPermissions] = useState([]);
  const [linkAccess, setLinkAccess] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const usersLoadedRef = useRef(null);
  const navigate = useNavigate();
  const extRef = useRef(null);

  useEffect(() => {
    setIsStarred((prev) => {
      const updated = { ...prev };
      item?.forEach((i) => {
        updated[i._id] = i.isStarred;
      });
      return updated;
    });
  }, [item]);

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
      setItem((prev) => prev.map((prev) => ({ ...prev, name: newName })));
    } catch (err) {
      setError(err.message);
    }
  }

  const handleToggleResourcePublic = async (item, role, access) => {
    setIsShareLoading(true);

    try {
      const itemId = item._id ?? item.id;
      const type = getResourceType(item);
      const isGoogleDrive = type.startsWith("google-drive");

      const restricted = access === "restricted";
      const userRole = DRIVE_ROLES[role] ?? "reader";

      let permission = null;

      await toggleFilePublic(itemId, userRole, access, type);

      const update = (list) =>
        list.map((resource) => {
          if (String(resource._id ?? resource.id) !== String(itemId)) {
            return resource;
          }

          const permissions = resource.permissions ?? [];

          const updatedPermissions = restricted
            ? permissions.filter((p) => p?.type !== "anyone")
            : [
                ...permissions.filter((p) => p?.type !== "anyone"),
                {
                  ...(permission ?? {}),
                  type: "anyone",
                  role: userRole,
                },
              ];

          return {
            ...resource,
            isPublic: restricted ? false : true,
            publicRole: restricted ? null : userRole,
            permissions: updatedPermissions,
          };
        });

      setItem((prev) => update(prev));
      setLinkAccess(restricted ? "restricted" : "anyone");
      setLinkRole(restricted ? "reader" : userRole);

      toast({
        message: "Public Access updated",
        type: "success",
      });
    } catch (error) {
      toast({
        message: error?.message || "Something went wrong!",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleSharedRoleUpdate = async (item, type, message) => {
    setIsShareLoading(true);

    try {
      const allPermissions = item?.permissions ?? [];
      const mergedPermissions = allPermissions.map((permission) => {
        const changedPermission = peopleWithAccess.find(
          (person) => String(person.id) === String(permission.id),
        );

        if (!changedPermission) {
          return permission;
        }

        return {
          ...permission,
          role: changedPermission.role,
        };
      });
      const newPermissions = mergedPermissions.filter(
        (permission) =>
          permission?.type !== "anyone" && permission?.role !== "owner",
      );

      const previousEditablePermissions = (item?.permissions ?? []).filter(
        (permission) =>
          permission?.type !== "anyone" && permission?.role !== "owner",
      );

      const result = await updateSharedAccess({
        item,
        type,
        peopleWithAccess: newPermissions,
        prevPermissions: previousEditablePermissions,
        message,
        grantAccessById,
        revokeFileAccess,
      });

      if (!result.changed) {
        setShareItem(null);
        return;
      }

      const updatedPeopleWithAccess = peopleWithAccess
        .map((p) => {
          const isRemoved = p.role === "remove";
          if (isRemoved) {
            return null;
          }
          return p;
        })
        .filter(Boolean);

      const update = (list) =>
        list.map((resource) => {
          const resourceId = String(resource?._id ?? resource?.id);
          if (resourceId !== String(result.itemId)) {
            return resource;
          }
          return {
            ...resource,
            permissions: updatedPeopleWithAccess,
          };
        });
      setItem((prev) => update(prev));
      setPeopleWithAccess(updatedPeopleWithAccess);
      setPrevPermissions(updatedPeopleWithAccess);
      setShareItem(null);

      toast({
        message: "Access updated",
        type: "success",
      });
    } catch (error) {
      toast({
        message: error?.message || "Something went wrong!",
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
      setItem([data]);
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

  async function handleToggleStar(item) {
    try {
      await Promise.all(
        item.map((i) => {
          const type = item.isDirectory ? "folder" : "file";
          setIsStarred((prev) => ({
            ...prev,
            [i._id]: !prev[i._id],
          }));
          return toggleItemStar(i._id, type);
        }),
      );
      setItem((prev) => prev.map((i) => ({ ...i, isStarred: !i.isStarred })));

      toast({
        message: `${item[0].name} ${item[0].isStarred ? "removed from" : "added to"} starred`,
        type: "success",
      });
    } catch (error) {
      setError(error.message);
    }
  }
  async function handleMoveToTrash(item) {

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
        key={item[0]._id}
        isStarred={isStarred}
        shareItem={shareItem}
        item={item[0]}
        onClose={() => window.close()}
        meta={true}
        isGDrive={false}
        onRename={(item) => {
          openRename(item);
        }}
        onShare={
          route === "direct"
            ? () => setShareItem(item[0])
            : (item) => setShareItem(item)
        }
        onTrash={() => handleMoveToTrash(item[0])}
        onStar={() => handleToggleStar(item)}
        onDownload={() =>
          window.open(
            `${BASE_URL}/file/${item[0]._id}?action=download`,
            "_blank",
          )
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
