import GoogleDriveSVG  from "../Icons/GoogleDriveSVG";

export default function GoogleDriveCard({ onOpen }) {
  return (
    <>
      <div className="gd-section-label">Connected storage</div>

      <div className="gd-grid" style={{ marginBottom: 8 }}>
        <div className="gd-grid-item" onClick={onOpen} style={{ cursor: "pointer" }}>
          <div className="gd-grid-item-preview">
            <GoogleDriveSVG size={48} />
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 8px 10px 12px", gap: 8 }}>
            <GoogleDriveSVG size={16} />
            <span className="gd-grid-item-name">Google Drive</span>
          </div>
        </div>
      </div>
    </>
  );
}