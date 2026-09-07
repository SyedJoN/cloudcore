import { IconClose } from "../Icons/Icons.jsx";
import FileBadge from "../File/FileBadge.jsx";
import { getFileIcon } from "../../../Utils/displayUtils.js";

export default function UploadTray({ dbFileId, uploadingFiles, progressMap, onCancel }) {
  if (!uploadingFiles.length) return null;

  return (
    <div className="gd-upload-tray">
      <div className="gd-upload-tray-header">
        <span>
          Uploading {uploadingFiles.length} item{uploadingFiles.length > 1 ? "s" : ""}
        </span>
        <button className="gd-icon-btn" style={{ color: "white" }}>
          <IconClose size={16} />
        </button>
      </div>

      {uploadingFiles.slice(0, 4).map(f => (
        <div key={f._id} className="gd-upload-item">
          <FileBadge type={getFileIcon(f.name)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gd-upload-item-name">{f.name}</div>
            <div className="gd-progress-bar">
              <div
                className="gd-progress-bar-fill"
                style={{ width: `${progressMap[f._id] || 0}%` }}
              />
            </div>
          </div>
          <button
            className="gd-icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => onCancel(f._id, dbFileId)}
            title="Cancel"
          >
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}