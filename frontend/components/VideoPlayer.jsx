import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import './VideoPlayer.css';

function VideoPlayer({ src, poster }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS — Safari only
      video.src = src;
    }

    return () => hls?.destroy();
  }, [src]);

  if (!src) {
    return <div className="vp-no-src">Video unavailable</div>;
  }

  return (
    <video
      ref={videoRef}
      controls
      poster={poster || undefined}
      className="vp-video"
      playsInline
      preload="metadata"
    />
  );
}

export default VideoPlayer;
