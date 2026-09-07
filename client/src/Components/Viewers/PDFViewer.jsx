function PDFViewer({ url }) {
  return (
    <div className="fv-pdf-stage">
      <iframe
        className="fv-pdf-frame"
        src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
        title="PDF Viewer"
      />
    </div>
  );
}

export default PDFViewer;