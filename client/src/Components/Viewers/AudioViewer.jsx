function AudioViewer({ url, name }) {
  return (
    <div className="fv-audio-stage">
      <div className="fv-audio-art">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: "#1a73e8", opacity: 0.7 }}
        >
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
      </div>
      <p className="fv-audio-name">{name}</p>
      <audio className="fv-audio" controls src={url} />
    </div>
  );
}
export default AudioViewer;