import { useEffect, useRef, useState } from "react";
import CircularLoader from "../Loaders/CircularLoader.jsx";
export default function DocxViewer({ url }) {
  const ref = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    if (ref.current) ref.current.innerHTML = "";

    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const blob = await res.blob();
        const { renderAsync } = await import("docx-preview");
        if (!cancelled && ref.current) await renderAsync(blob, ref.current);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p>Preview load nahi hua: {error}</p>;

  return (
    <>
      {loading && (
        <div className="flex justify-center items-center w-full p-2">
          <CircularLoader />
        </div>
      )}
      <div ref={ref} className={`${loading ? "hidden" : ""} fv-office-doc`} />
    </>
  );
}
