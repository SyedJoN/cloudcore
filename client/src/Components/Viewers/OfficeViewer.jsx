import { useState } from "react";

function OfficeViewer({ item, category }) {
  const fileUrl = `${BASE_URL}/file/${item._id}`;
  // Try Microsoft Office Online viewer (requires publicly accessible URL — show fallback)
  const [useMicrosoft] = useState(false); // set true if your server is public

  const appMap = {
    "office-word": "Word",
    "office-excel": "Excel",
    "office-ppt": "PowerPoint",
  };
  const iconMap = {
    "office-word": { color: "#185abd", label: "DOCX" },
    "office-excel": { color: "#107c41", label: "XLSX" },
    "office-ppt": { color: "#c43e1c", label: "PPTX" },
  };
  const info = iconMap[category] || { color: "#5f6368", label: "FILE" };

  if (useMicrosoft) {
    const encoded = encodeURIComponent(fileUrl);
    return (
      <div className="fv-office-stage">
        <iframe
          className="fv-pdf-frame"
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`}
          title={appMap[category]}
        />
      </div>
    );
  }

  return (
    <div className="fv-unknown-stage">
      <div className="fv-unknown-icon" style={{ background: info.color }}>
        {info.label}
      </div>
      <p className="fv-unknown-name">{item.name}</p>
      <p className="fv-unknown-hint">
        Office files can't be previewed directly.
        <br />
        Download the file to open it in {appMap[category]}.
      </p>
      <a
        href={fileUrl}
        download={item.name}
        className="fv-unknown-download-btn"
      >
        <IconDownload size={16} /> Download to view
      </a>
    </div>
  );
}
export default OfficeViewer;
