export default function PDFViewer({ url }) {
  return (
    <div
      className="fv-pdf-stage"
      style={{ width: "100%", height: "100%", display: "flex" }}
    >
      <iframe
        className="fv-pdf-frame"
        style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
        src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
        title="PDF Viewer"
      />
    </div>
  );
}