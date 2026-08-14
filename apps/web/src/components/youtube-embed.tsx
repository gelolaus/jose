"use client";

export function YoutubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-black shadow-md ring-1 ring-black/10">
      <div className="relative aspect-video w-full">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
