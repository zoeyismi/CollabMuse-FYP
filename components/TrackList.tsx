import { Volume2, VolumeX } from "@/components/Icons";
import { tracks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function TrackList() {
  return (
    <aside className="surface-light flex h-full min-h-[520px] flex-col rounded-[28px] p-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[#071014]/38">Tracks</p>
          <h2 className="mt-1 text-lg font-semibold text-[#071014]">Arrangement</h2>
        </div>
        <span className="rounded-full border border-[#071014]/10 bg-[#071014]/5 px-3 py-1 text-xs text-[#071014]/55">
          4 lanes
        </span>
      </div>
      <div className="space-y-3">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="rounded-2xl border border-[#071014]/10 bg-[#071014]/[0.045] p-4 transition hover:bg-[#071014]/[0.07]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn("h-3 w-3 rounded-full")} style={{ background: track.color }} />
                <div>
                  <p className="text-sm font-medium text-[#071014]">{track.name}</p>
                  <p className="text-xs text-[#071014]/45">{track.clips} clips synced</p>
                </div>
              </div>
              {track.muted ? (
                <VolumeX className="h-4 w-4 text-[#071014]/35" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#071014]/45" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto rounded-2xl border border-[#58e081]/30 bg-[#58e081]/14 p-4 text-xs leading-5 text-[#071014]/58">
        Prototype note: these lanes show shared project state. A later Socket.io layer can broadcast edits as room events.
      </div>
    </aside>
  );
}
