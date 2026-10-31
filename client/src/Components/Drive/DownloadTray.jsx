import { IconClose } from "../Icons/Icons.jsx";
import FileBadge from "../File/FileBadge.jsx";
import { getFileIcon } from "../../../Utils/displayUtils.js";

export default function DownloadTray({
  downloads,
  progressMap,
  onCancel,
}) {
  if (!downloads.length) return null;

  return (
    <div className="gd-upload-tray">
      <div className="gd-upload-tray-header">
        <span>
          Zipping {downloads.length} item
          {downloads.length > 1 ? "s" : ""}
        </span>
      </div>

      {downloads.slice(0, 4).map((file) => {
        const progress = progressMap[file._id] || 0;

        return (
          <div
            key={file._id}
            className="gd-upload-item"
          >
            <FileBadge
              type={getFileIcon(file.name)}
            />

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div className="gd-upload-item-name">
                {file.name}
              </div>

              <div className="gd-progress-bar">
                <div
                  className="gd-progress-bar-fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#aaa",
                  marginTop: 4,
                }}
              >
                {progress}%
              </div>
            </div>

            <button
              className="gd-icon-btn"
              style={{
                width: 28,
                height: 28,
              }}
              onClick={() => onCancel(file._id)}
              title="Cancel"
            >
              <IconClose size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}