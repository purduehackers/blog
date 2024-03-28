import YouTube from 'react-youtube'

export function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <div className="w-full text-center rounded-lg">
      <YouTube
        className="youtubeContainer"
        style={{ borderRadius: '8px' }}
        videoId={videoId}
      />
    </div>
  )
}
