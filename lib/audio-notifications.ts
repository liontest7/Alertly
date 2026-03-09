export class AudioNotificationManager {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext not available');
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  playAlertNotification(): void {
    if (!this.isEnabled) return;

    if (this.audioContext) {
      try {
        this.playWebAudioAPI();
      } catch (e) {
        this.playFallbackAudio();
      }
    } else {
      this.playFallbackAudio();
    }
  }

  private playWebAudioAPI(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Create oscillator for beep sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    // Double beep pattern
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
    
    // Second beep
    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();
    
    osc2.connect(gain2);
    gain2.connect(this.audioContext.destination);
    
    osc2.frequency.setValueAtTime(900, now + 0.15);
    osc2.frequency.setValueAtTime(700, now + 0.25);
    
    gain2.gain.setValueAtTime(0.15, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc2.start(now + 0.15);
    osc2.stop(now + 0.25);
  }

  private playFallbackAudio(): void {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play notification sound');
    }
  }
}

export const audioManager = typeof window !== 'undefined' ? new AudioNotificationManager() : null;
