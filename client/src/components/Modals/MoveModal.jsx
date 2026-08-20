import { useState, useEffect } from "react";
import { IconFolder, IconClose, IconChevronDown } from "./../Icons/Icons";
import { addDirectory } from "../../../apis/directoryApi";
import FileBadge from "../File/FileBadge";
import { getFileIcon } from "../../../Utils/displayUtils";
import { moveItem } from "../../../apis/resourceApi";
import { useToast } from "../../Contexts";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function MoveModal({
  item,
  currentDirId,
  setDirectoriesList,
  setFilesList,
  onClose,
}) {
  const { toast } = useToast();
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: null, name: "My Drive" },
  ]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("Untitled folder");
  const [rootDirId, setRootDirId] = useState(null);

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];


  const isSameLocation =
    currentCrumb.id === currentDirId ||
    (currentCrumb.id === null && !currentDirId);

  const isEmpty = folders.length === 0 && files.length === 0 && !isCreating;

  useEffect(() => {
    loadFolders(currentCrumb.id);
  }, [currentCrumb.id]);

  async function loadFolders(parentId) {
    setIsLoading(true);
    try {
      const api = parentId ? `/directory/${parentId}` : `/directory/`;
      const res = await fetch(`${BASE_URL}${api}`, { credentials: "include" });
      const data = await res.json();
      if (!parentId) {
        setRootDirId(data._id);
      }
      setFolders((data.directories || []).filter((d) => d._id !== item?._id));
      setFiles(data.files || []);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  }

  function navigateInto(folder) {
    setBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.name }]);
  }

  function navigateTo(index) {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const response = await addDirectory(
        currentCrumb.id,
        newFolderName.trim(),
        "local",
      );
      setIsCreating(false);
      setNewFolderName("Untitled folder");
      if (isSameLocation) {
        setDirectoriesList((prev) => [response.data, ...prev]);
      }
      setFolders((prev)=> [response.data, ...prev])
    } catch (_) {}
  }

  async function handleMove() {
    setIsMoving(true);
    try {
      const message = await moveItem({
        item,
        destinationId: currentCrumb.id && currentCrumb.id || rootDirId,
        destinationName: currentCrumb.name,
      });
      onClose();
      const type = item.isDirectory ? "folder" : "file";
      if (type === "folder") {
        setDirectoriesList((prev) =>
          prev.filter((list) => list._id !== item._id),
        );
      } else {
        setFilesList((prev) => prev.filter((list) => list._id !== item._id));
      }

      toast({ message, type: "success" });
    } catch (err) {
      toast({ message: err.message || "Something went wrong", type: "error" });
      console.log(err.message);
      setIsMoving(false);
    }
  }

  return (
    <div className="gd-modal-overlay" onClick={onClose}>
      <div className="mv-modal" onClick={(e) => e.stopPropagation()}>
  
        <div className="mv-header">
          <span className="mv-title">Move "{item?.name}"</span>
          <button className="gd-icon-btn" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>


        <div className="mv-breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="mv-breadcrumb-item">
                {!isLast ? (
                  <>
                    <button
                      className="mv-breadcrumb-btn"
                      onClick={() => navigateTo(i)}
                    >
                      {crumb.name}
                    </button>
                    <IconChevronDown
                      size={14}
                      style={{
                        transform: "rotate(-90deg)",
                        color: "#80868b",
                        flexShrink: 0,
                      }}
                    />
                  </>
                ) : (
                  <span className="mv-breadcrumb-current">{crumb.name}</span>
                )}
              </span>
            );
          })}
        </div>

 
        <div className="mv-folder-list">
          {isLoading ? (
            <div className="mv-loading">
              <div className="gd-spinner" />
            </div>
          ) : isEmpty ? (
            <div className="mv-empty">No items in this location</div>
          ) : (
            <>
           
              {folders.map((folder) => (
                <div
                  key={folder._id}
                  className="mv-folder-row"
                  onDoubleClick={() => navigateInto(folder)}
                >
                  <IconFolder
                    size={20}
                    style={{ color: "#5f6368", flexShrink: 0 }}
                  />
                  <span className="mv-folder-name">{folder.name}</span>
                  <button
                    className="mv-open-btn"
                    title="Open folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateInto(folder);
                    }}
                  >
                    <IconChevronDown
                      size={16}
                      style={{ transform: "rotate(-90deg)" }}
                    />
                  </button>
                </div>
              ))}

      
              {files.map((file) => (
                <div key={file._id} className="mv-folder-row mv-file-row">
                  <FileBadge type={getFileIcon(file.name)} />
                  <span className="mv-folder-name mv-file-name">
                    {file.name}
                  </span>
                </div>
              ))}
            </>
          )}

 
          {isCreating && (
            <form className="mv-new-folder-row" onSubmit={handleCreateFolder}>
              <IconFolder
                size={20}
                style={{ color: "#5f6368", flexShrink: 0 }}
              />
              <input
                className="mv-new-folder-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <div className="mv-new-folder-actions">
                <button
                  type="button"
                  className="gd-btn gd-btn-text"
                  onClick={() => {
                    setIsCreating(false);
                    setNewFolderName("New folder");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="gd-btn gd-btn-primary">
                  Create
                </button>
              </div>
            </form>
          )}
        </div>

    
        <div className="mv-footer">
          <button
            className="mv-new-folder-btn"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
          >
            + New folder
          </button>
          <div className="mv-footer-actions">
            <button className="gd-btn gd-btn-text" onClick={onClose}>
              Cancel
            </button>
            <button
              className="gd-btn gd-btn-primary"
              onClick={handleMove}
              disabled={isSameLocation || isMoving}
            >
              {isMoving ? "Moving…" : "Move here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
