import { useEffect, useRef, useState } from "react";

export default function OfficeViewer({ BASE_URL, item, category }) {
  const ref = useRef(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const url = `${BASE_URL}/file/${item._id}`;

  useEffect(() => {
    if (category === "office-ppt") return;

    let cancelled = false;
    setError("");
    setHtml("");
    setLoading(true);
    if (ref.current) ref.current.innerHTML = "";

    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);

        if (category === "office-word") {
          const { renderAsync } = await import("docx-preview");
          const blob = await res.blob();
          if (!cancelled && ref.current) await renderAsync(blob, ref.current);
        } else if (category === "office-excel") {
          const XLSX = await import("xlsx");
          const DOMPurify = (await import("dompurify")).default;
          const wb = XLSX.read(await res.arrayBuffer());
          const raw = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
          if (!cancelled) setHtml(DOMPurify.sanitize(raw));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, category]);

  if (category === "office-ppt")
    return <p>PPTX ka preview abhi available nahi. Download karein.</p>;
  if (error) return <p className="flex justify-center items-center h-full">Preview load nahi hua: {error}</p>;

  return (
    <>
      {loading && <p>Loading...</p>}
      {category === "office-word" ? (
        <div ref={ref} className="fv-office-doc" />
      ) : (
        <div
          className="fv-office-sheet"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </>
  );
}