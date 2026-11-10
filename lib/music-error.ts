const chineseErrors: Record<string, string> = {
  "ElevenLabs is not configured. Choose the built-in arranger or configure the API key.": "尚未配置 ElevenLabs。请选择内置编曲器，或配置 API 密钥。",
  "ElevenLabs requires a paid plan. Choose the built-in arranger or configure a paid account.": "ElevenLabs 需要付费方案。请选择内置编曲器，或配置付费账号。",
  "ElevenLabs could not generate this track. Check the service configuration and try again.": "ElevenLabs 未能生成音乐，请检查服务配置后重试。",
  "ElevenLabs was unavailable or timed out. Check the connection and try again.": "ElevenLabs 暂时不可用或请求超时，请检查连接后重试。",
  "Music service did not return MP3 audio.": "音乐服务没有返回 MP3 音频。",
  "Music service returned an audio file that is too large.": "音乐服务返回的音频文件超过大小限制。",
  "Music service returned an empty audio file.": "音乐服务返回了空音频文件。",
  "Music service returned invalid MP3 audio.": "音乐服务返回的 MP3 音频无效。",
};

export function musicErrorMessage(message: string, language: string): string {
  return language === "zh" && Object.hasOwn(chineseErrors, message) ? chineseErrors[message] : message;
}

export function isUnconfiguredMusicService(status: number, message: unknown): boolean {
  return status === 503 && message === "ElevenLabs is not configured. Choose the built-in arranger or configure the API key.";
}
