function VideoViewer({ url }) {
  return (
    <div className="fv-video-stage">
      <video className="fv-video" controls autoPlay={true} preload="metadata">
        <source src={url} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}
export default VideoViewer;