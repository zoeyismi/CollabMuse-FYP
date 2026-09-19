import { WaveformEditor } from "@/components/WaveformEditor";

export function HomepageProductReveal() {
  return (
    <div className="hero-reveal mx-auto mt-14 w-full max-w-6xl px-2 sm:px-6">
      <div className="node-panel overflow-hidden rounded-t-[34px] border border-white/18 bg-[linear-gradient(145deg,rgba(88,224,129,0.14),rgba(11,21,30,0.86)_62%,rgba(4,7,10,0.96))] p-4 shadow-[0_-24px_90px_rgba(88,224,129,0.10),0_34px_100px_rgba(0,0,0,0.46)] sm:p-5">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/14 bg-[#071014]/72 px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Room active</p>
            <h3 className="mt-1 text-sm font-semibold text-white sm:text-base">Always session</h3>
          </div>
          <div className="rounded-full border border-white/14 bg-[#58e081] px-3 py-1 text-xs font-semibold text-[#071014]">
            events synced
          </div>
        </div>

        <div className="grid min-h-[260px] gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <WaveformEditor compact />

          <div className="hidden overflow-hidden rounded-3xl border border-white/14 bg-[#141615]/88 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl lg:block">
            <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-2xl font-semibold tracking-normal text-white">Shared room edits</p>
              <p className="mt-2 text-sm leading-6 text-white/48">Clip actions become synced room events.</p>
              <div className="mt-8 space-y-3">
                {[
                  ["Move clip", "#b71912"],
                  ["Mark section", "#efd84c"],
                  ["Sync edit", "#235fba"],
                  ["Room note", "#58e081"],
                ].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-white/72">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
