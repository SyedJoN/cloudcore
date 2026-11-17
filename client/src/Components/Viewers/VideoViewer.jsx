function VideoViewer({ url }) {
  return (
    <div className="fv-video-stage">
      <video
        className="fv-video"
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
      >
        <source src={url} type="video/mp4" />
      </video>
    </div>
  );
}

export default VideoViewer;