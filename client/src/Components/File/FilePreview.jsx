import { useEffect, useRef, useState } from "react";
import { extOf, getFileKind, isLegacyWord } from "../../../Utils/fileKind";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

const MAX_OFFICE_BYTES = 10 * 1024 * 1024;

// ── Colour + icon per file type ───────────────────────────────────────────────
const TYPE_META = {
  image:   { bg: "#e8f5e9", color: "#2e7d32", icon: "🖼️",  label: "IMAGE"   },
  video:   { bg: "#fce4ec", color: "#c62828", icon: "🎬",  label: "VIDEO"   },
  pdf:     { bg: "#fce8e6", color: "#d93025", icon: "📄",  label: "PDF"     },
  code:    { bg: "#e8eaf6", color: "#3949ab", icon: "💻",  label: "CODE"    },
  archive: { bg: "#fff8e1", color: "#f57f17", icon: "📦",  label: "ZIP"     },
  audio:   { bg: "#f3e5f5", color: "#6a1b9a", icon: "🎵",  label: "AUDIO"   },
  doc:     { bg: "#e3f2fd", color: "#1565c0", icon: "📝",  label: "DOC"     },
  sheet:   { bg: "#e8f5e9", color: "#1b5e20", icon: "📊",  label: "SHEET"   },
  slide:   { bg: "#fff3e0", color: "#e65100", icon: "📑",  label: "SLIDES"  },
  alt:     { bg: "#f1f3f4", color: "#5f6368", icon: "📎",  label: "FILE"    },
};

const getExt = (filename = "") => filename.split(".").pop().toLowerCase();

function getType(filename = "") {
  const ext = getExt(filename);
  if (["png","jpg","jpeg","gif","webp","svg","bmp","ico"].includes(ext))        return "image";
  if (["mp4","mov","avi","mkv","webm","ogv"].includes(ext))                     return "video";
  if (["pdf"].includes(ext))                                                    return "pdf";
  if (["zip","rar","tar","gz","7z","bz2"].includes(ext))                        return "archive";
  if (["mp3","wav","ogg","flac","aac","m4a"].includes(ext))                     return "audio";
  if (["doc","docx","odt","rtf","txt","md"].includes(ext))                      return "doc";
  if (["xls","xlsx","ods","csv"].includes(ext))                                 return "sheet";
  if (["ppt","pptx","odp"].includes(ext))                                       return "slide";
  if (["js","jsx","ts","tsx","html","css","py","java","go","rs","cpp","c","cs",
       "json","yaml","yml","sh","php","rb","swift","kt"].includes(ext))         return "code";
  return "alt";
}

const FILL = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: "#fff",
};

// ── Fallback card shown for non-visual types (and while a preview loads) ─────
function IconCard({ type, item }) {
  const meta = TYPE_META[type] || TYPE_META.alt;
  const e = extOf(item).toUpperCase();
  const label = e && e !== "BIN" && e.length <= 5 ? e : meta.label;

  return (
    <div style={{
      width: "100%", height: "100%",
      background: meta.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 6,
    }}>
      <span style={{ fontSize: 32, lineHeight: 1 }}>{meta.icon}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        color: meta.color, fontFamily: "var(--font-main)",
        background: meta.color + "22",
        padding: "2px 7px", borderRadius: 4,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── helpers: lazy loading, small job queue, cache ────────────────────────────

function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return [ref, seen];
}

// ek waqt mein sirf 2 previews render hon, taake grid na atke
const MAX_PARALLEL = 2;
let running = 0;
const queue = [];

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`preview task timed out after ${ms}ms`)), ms),
    ),
  ]);

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const { task, resolve, reject } = queue.shift();
    running++;
    withTimeout(task(), 30000)
      .then(resolve, reject)
      .finally(() => {
        running--;
        pump();
      });
  }
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pump();
  });
}

const thumbCache = new Map(); // PDF image + Excel rows
const cacheKey = (item, url) =>
  `${url}|${item.updatedAt ?? item.modifiedTime ?? ""}|${item.size ?? ""}`;

const tooBig = (item) => Number(item.size) > MAX_OFFICE_BYTES;

// ── PDF: pehla page canvas par render ────────────────────────────────────────


async function renderPdfThumb(url) {
  let stage = "fetch";
  let loadingTask;

  try {
    const res = await fetch(url, { credentials: "include" });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();

    stage = "import pdfjs";

    const pdfjs = await import("pdfjs-dist");


    stage = "import worker";

    const { default: workerSrc } = await import(
      "pdfjs-dist/build/pdf.worker.min.mjs?url"
    );

    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    stage = "parse";

    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buf),
    });

    const pdf = await loadingTask.promise;


    stage = "render";

    const page = await pdf.getPage(1);

    const base = page.getViewport({ scale: 1 });

    const viewport = page.getViewport({
      scale: 400 / base.width,
    });

    const canvas = document.createElement("canvas");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toDataURL("image/jpeg", 0.8);

  } catch (err) {
    err.message = `[stage: ${stage}] ${err.message}`;
    throw err;

  } finally {
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (err) {
        console.warn("[pdf] cleanup failed:", err);
      }
    }
  }
}


function PdfThumb({ item, url }) {
  const [ref, seen] = useInView();
  const key = cacheKey(item, url);
  const [src, setSrc] = useState(() => thumbCache.get(key) ?? null);

useEffect(() => {
  if (!seen || src) return;
  let cancelled = false;

  enqueue(() => renderPdfThumb(url))
    .then((dataUrl) => {
      thumbCache.set(key, dataUrl);
      if (!cancelled) setSrc(dataUrl);
    })
    .catch((err) => console.error("[pdf] thumbnail failed:", item.name, err));

  return () => {
    cancelled = true;
  };
}, [seen, src, key, url]);
  return (
    <div ref={ref} style={FILL}>
      {src ? (
        <img
          src={src}
          alt={item.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top",
            display: "block",
          }}
        />
      ) : (
        <IconCard type="pdf" name={item} />
      )}
    </div>
  );
}

// ── Excel: pehli sheet ki chhoti table ───────────────────────────────────────
async function loadSheetRows(url) {
  const XLSX = await import("xlsx");
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("fetch failed");

  const wb = XLSX.read(await res.arrayBuffer(), { type: "array", sheetRows: 14 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  return rows.slice(0, 12).map((r) => r.slice(0, 6).map((c) => String(c)));
}

function SheetThumb({ item, url }) {
  const [ref, seen] = useInView();
  const key = cacheKey(item, url);
  const [rows, setRows] = useState(() => thumbCache.get(key) ?? null);

  useEffect(() => {
    if (!seen || rows) return;
    let cancelled = false;

    enqueue(() => loadSheetRows(url))
      .then((data) => {
        thumbCache.set(key, data);
        if (!cancelled) setRows(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [seen, rows, key, url]);

  return (
    <div ref={ref} style={FILL}>
      {rows && rows.length ? (
        <table
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            fontSize: 9,
            lineHeight: 1.3,
            fontFamily: "Arial, sans-serif",
            color: "#202124",
          }}
        >
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    style={{
                      border: "1px solid #e0e0e0",
                      padding: "2px 4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: r === 0 ? 700 : 400,
                      background: r === 0 ? "#e6f4ea" : "#fff",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <IconCard type="sheet" name={item} />
      )}
    </div>
  );
}

function DocxThumb({ item, url }) {
  const [ref, seen] = useInView();
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!seen) return;
    let cancelled = false;

    enqueue(async () => {
      const { renderAsync } = await import("docx-preview");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();

      const host = hostRef.current;
      if (!host || cancelled) return;

      await renderAsync(blob, host, null, {
        inWrapper: false,
        breakPages: true,
        renderHeaders: false,
        renderFooters: false,
        renderFootnotes: false,
        renderEndnotes: false,
        useBase64URL: true,
      });
      if (cancelled) return;

      const page = host.querySelector("section.docx");
      const pageWidth = page?.offsetWidth || 794;
      const outerWidth = ref.current?.clientWidth || 220;

      host.style.width = `${pageWidth}px`;
      host.style.transform = `scale(${outerWidth / pageWidth})`;
      setReady(true);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [seen, url]);

  return (
    <div ref={ref} style={FILL}>
      <div
        ref={hostRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "top left",
          opacity: ready ? 1 : 0,
          pointerEvents: "none",
        }}
      />
      {!ready && (
        <div style={{ position: "absolute", inset: 0 }}>
          <IconCard type="doc" name={item} />
        </div>
      )}
    </div>
  );
}

// ── Main preview component ────────────────────────────────────────────────────
export default function FilePreview({ item }) {
  const [imgError, setImgError] = useState(false);
const kind = getFileKind(item);
const META_KEY = { word: "doc", excel: "sheet", ppt: "slide", text: "doc", folder: "alt" };
  const type = META_KEY[kind] ?? kind;
  const isLocal = Boolean(item._id) && !item.webViewLink;
  const localUrl = isLocal ? `${BASE_URL}/file/${item._id}` : null;

  const gdriveThumbnail = item.thumbnailLink
    ? item.thumbnailLink.replace(/=s\d+$/, "=s400")
    : item.hasThumbnail && item.id
      ? `https://drive.google.com/thumbnail?id=${item.id}&sz=w400`
      : null;

  // Local image — served directly from the backend
  const localImageUrl = kind === "image" && localUrl ? localUrl : null;

  // Local video — show poster from first frame via video element
  const localVideoUrl = kind === "video" && localUrl ? localUrl : null;

  const thumbnailUrl = gdriveThumbnail || localImageUrl;

  // ── Image / GDrive thumbnail (Drive ke PDF, Word, Excel bhi yahin se aate hain) ──
  if (thumbnailUrl && !imgError) {
    return (
      <img
        src={thumbnailUrl}
        alt={item.name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: gdriveThumbnail ? "top" : "center",
          display: "block",
        }}
      />
    );
  }

  // ── Local video — HTML5 video poster ────────────────────────────────────
  if (localVideoUrl) {
    return (
      <video
        src={localVideoUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        muted preload="metadata"
        onError={() => {}}
      />
    );
  }

  // ── Local PDF / Word / Excel — asli preview ─────────────────────────────
 if (localUrl) {
    const k = cacheKey(item, localUrl);

    if (kind === "pdf") return <PdfThumb key={k} item={item} url={localUrl} />;
    if (kind === "word" && !isLegacyWord(item) && !tooBig(item))
      return <DocxThumb key={k} item={item} url={localUrl} />;
    if (kind === "excel" && !tooBig(item))
      return <SheetThumb key={k} item={item} url={localUrl} />;
  }

  // ── Everything else — styled icon card ──────────────────────────────────
  return <IconCard type={type} name={item} />;
}