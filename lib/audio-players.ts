export function pauseAudioPlayers(players: Iterable<Pick<HTMLAudioElement, "pause"> | null>): void {
  for (const player of players) player?.pause();
}

export function pauseOtherAudioPlayers<T extends Pick<HTMLAudioElement, "pause">>(players: Iterable<T>, active: T): void {
  for (const player of players) if (player !== active) player.pause();
}
