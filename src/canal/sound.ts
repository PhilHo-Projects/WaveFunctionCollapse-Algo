/** Tiny synthesized ceramic/wood notes: no audio download and no autoplay. */
export class TownSound {
  private context: AudioContext | null = null;
  async unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }
  play(kind: "build" | "remove" | "paint", height = 1) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    const notes =
      kind === "paint"
        ? [659.25, 880]
        : kind === "remove"
          ? [220, 164.81]
          : [293.66, 440, 587.33];
    notes.forEach((note, i) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      const start = now + i * 0.035;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note * (1 + height * 0.025), start);
      oscillator.frequency.exponentialRampToValueAtTime(
        note * 0.98,
        start + 0.18,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045 / (i + 1), start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.26);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  dispose() {
    void this.context?.close();
    this.context = null;
  }
}
