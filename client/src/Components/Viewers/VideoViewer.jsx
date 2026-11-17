function VideoViewer({ url }) {
  return (
    <div className="fv-video-stage">
      <video className="fv-video" autoPlay={true} preload="metadata" playsInline controls={false}>
        <source src={url} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}
export default VideoViewer;