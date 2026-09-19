import { CloudUpload, MessageCircle, MousePointer2, SlidersHorizontal } from "@/components/Icons";
import type { IconComponent } from "@/components/Icons";
import type { RoomEvent, RoomEventKind } from "@/lib/mock-data";

const eventMeta: Record<RoomEventKind, { icon: IconComponent; color: string }> = {
  upload: { icon: CloudUpload, color: "#b71912" },
  move: { icon: MousePointer2, color: "#235fba" },
  rename: { icon: SlidersHorizontal, color: "#efd84c" },
  note: { icon: MessageCircle, color: "#58e081" },
  sync: { icon: SlidersHorizontal, color: "#235fba" },
  remix: { icon: SlidersHorizontal, color: "#efd84c" },
  extend: { icon: MousePointer2, color: "#58e081" },
};

type EventActivityProps = {
  events: RoomEvent[];
};

export function EventActivity({ events }: EventActivityProps) {
  return (
    <section className="rounded-[28px] border border-white/14 bg-white/[0.07] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/38">Room events</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Recent collaboration updates</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-white/42">
          Click a waveform action to append a mock event. Open another tab to see the local sync demo.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {events.map((event) => {
          const meta = eventMeta[event.kind];
          const Icon = meta.icon;
          const darkText = meta.color === "#efd84c" || meta.color === "#58e081";

          return (
            <div key={event.id} className="min-h-[124px] rounded-2xl border border-white/10 bg-[#071014]/55 p-4">
              <div className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: meta.color,
                    color: darkText ? "#11120b" : "#fff",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{event.title}</p>
                    <span className="shrink-0 text-[10px] text-white/30">{event.time}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/45">{event.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
