export function waveformPeaksFromSamples(samples: Float32Array, bucketCount = 96): number[] {
  const bucketSize = Math.max(1, Math.floor(samples.length / bucketCount));
  const rmsPeaks = Array.from({ length: bucketCount }, (_, bucketIndex) => {
    const start = bucketIndex * bucketSize;
    const end = bucketIndex === bucketCount - 1 ? samples.length : Math.min(samples.length, start + bucketSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += samples[index] * samples[index];
    return Math.sqrt(sum / Math.max(1, end - start));
  });
  const strongestPeak = Math.max(...rmsPeaks, 0.001);
  return rmsPeaks.map((peak) => Math.round(18 + (peak / strongestPeak) * 44));
}
