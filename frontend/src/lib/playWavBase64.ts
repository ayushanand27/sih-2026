/** Decode a base64 WAV from `/query` `audio_base64` and play it. */
export function playWavBase64(
  audioBase64: string,
  onEnded?: () => void
): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
  if (onEnded) {
    audio.onended = () => onEnded();
    audio.onerror = () => onEnded();
  }
  void audio.play();
  return audio;
}
