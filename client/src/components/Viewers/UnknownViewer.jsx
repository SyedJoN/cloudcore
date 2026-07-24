function UnknownViewer({ item }) {
  const ext = getExt(item.name);
  return (
    <div className="fv-unknown-stage">
      <div className="fv-unknown-icon" style={{ background: "#5f6368" }}>
        {ext.toUpperCase() || "FILE"}
      </div>
      <p className="fv-unknown-name">{item.name}</p>
      <p className="fv-unknown-hint">
        No preview available for this file type.
      </p>
      <a
        href={`${BASE_URL}/file/${item._id}`}
        download={item.name}
        className="fv-unknown-download-btn"
      >
        <IconDownload size={16} /> Download file
      </a>
    </div>
  );
}
export default UnknownViewer;
