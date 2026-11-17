function VideoViewer({ url }) {
  console.log('url', url)
  return (
    <div className="fv-video-stage">
      <video className="fv-video" autoPlay={true} preload="metadata" playsInline controls>
        <source src={url} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}
export default VideoViewer;