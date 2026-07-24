import { useState, useEffect } from "react";

function TextViewer({ url, name }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const ext = getExt(name);
  const isCode = !["txt", "md", "log", "csv"].includes(ext);
  const isMarkdown = ext === "md";
  const isCSV = ext === "csv";

  useEffect(() => {
  
    fetch(url, { credentials: "include" })
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError("Could not load file."));
  }, [url]);

  if (error) return <div className="fv-text-error">{error}</div>;
  if (content === null)
    return (
      <div className="fv-text-loading">
        <div className="fv-spinner" />
      </div>
    );

  if (isCSV) {
    const rows = content
      .trim()
      .split("\n")
      .map((r) => r.split(","));
    return (
      <div className="fv-csv-stage">
        <table className="fv-csv-table">
          <thead>
            <tr>
              {rows[0]?.map((h, i) => (
                <th key={i}>{h.replace(/^"|"$/g, "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell.replace(/^"|"$/g, "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isCode) {
    const lines = content.split("\n");
    return (
      <div className="fv-code-stage">
        <div className="fv-code-lang">{ext.toUpperCase()}</div>
        <div className="fv-code-block">
          {lines.map((line, i) => (
            <useCode key={i} line={line} num={i + 1} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fv-text-stage">
      <pre className="fv-text-content">{content}</pre>
    </div>
  );
}

export default TextViewer;