import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FileViewer from "../components/File/FileViewer";
import { getFileByMetaId, toggleFilePublic } from "../../apis/fileApi";
import ShareModal from "../components/Modals/ShareModal";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { useRef } from "react";
import { useAuth } from "../Contexts";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function FileViewPage() {
  const {user, setUser, refreshUser} = useAuth();
  const { fileId } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const [shareItem, setShareItem] = useState(null);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameType, setRenameType] = useState("");
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

  useEffect(() => {
    refreshUser();
  }, []);

  async function getFile() {
    await getFileById(fileId);
  }
  useEffect(() => {
    getFile();
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
        item={item}
        onClose={() => window.close()}
        meta={true}
        isGDrive={false}
        onRename={(item) => {
          openRename(item);
        }}
        onShare={
          item?.publicRole === "editor" ||
          item?.publicRole === "owner" ||
          item.userRole === "editor" ||
          item?.userRole === "owner"
            ? (item) => {
                setShareItem(item);
              }
            : null
        }
        onSoftDelete={(item) => handleMoveToTrash(item)}
        onDownload={() =>
          window.open(`${BASE_URL}/file/${item._id}?action=download`, "_blank")
        }
      />
      {shareItem && (
        <ShareModal
          item={shareItem}
          onClose={handleShareItem}
          setShareItem={setShareItem}
          isShareLoading={isShareLoading}
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
