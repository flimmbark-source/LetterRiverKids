/**
 * TTS Service using Web Speech API
 *
 * Simple implementation that speaks native language text directly:
 * - Actively loads voices on app start (mobile-friendly)
 * - Always creates fresh utterances to prevent stuck state
 * - Minimal state management to avoid corruption
 * - Delays between utterances to let the engine reset
 * - No automatic fallbacks or transliteration logic
 */

class TtsService {
  constructor() {
    this.currentUtterance = null;
    this.listeners = new Set();
    this.isSpeaking = false;
    this.lastSpeakTime = 0;
    this.voices = [];
    this.audioUnlocked = false;

    // Actively load voices on startup
    this.loadVoices();

    // Unlock audio on mobile on first user interaction
    if (this.isMobile()) {
      this.setupAudioUnlock();
    }
  }

  /**
   * Setup audio unlock for mobile browsers
   * Many mobile browsers require a user interaction to unlock audio playback
   */
  setupAudioUnlock() {
    const unlockAudio = () => {
      if (this.audioUnlocked) return;

      console.log('[TTS] Attempting to unlock audio...');

      // Use HTML5 Audio to unlock audio context (more reliable than silent speech)
      // Create a tiny silent audio data URI
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');

      // Play and immediately pause
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            silentAudio.pause();
            silentAudio.currentTime = 0;
            console.log('[TTS] ✓ Audio unlocked successfully via HTML5 Audio');
          })
          .catch(e => {
            console.warn('[TTS] Audio unlock failed:', e);
          });
      }

      // Also try to unlock speech synthesis
      const synth = this.getSynth();
      if (synth) {
        try {
          const silent = new SpeechSynthesisUtterance('');
          silent.volume = 0;
          silent.rate = 10;
          synth.speak(silent);
          console.log('[TTS] ✓ Speech synthesis unlocked');
        } catch (e) {
          console.warn('[TTS] Failed to unlock speech synthesis:', e);
        }
      }

      this.audioUnlocked = true;

      // Remove listeners after first unlock attempt
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };

    // Listen for first user interaction
    document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    document.addEventListener('click', unlockAudio, { once: true, passive: true });
  }

  /**
   * Actively load voices by repeatedly calling getVoices()
   * This is more reliable than waiting for onvoiceschanged on mobile
   */
  loadVoices() {
    const synth = this.getSynth();
    if (!synth) return;

    // Try to get voices immediately
    this.voices = synth.getVoices();
    console.log('[TTS] Initial getVoices():', this.voices.length, 'voices');

    // If no voices yet, keep trying for a few seconds
    // Mobile browsers often need multiple attempts before voices populate
    if (this.voices.length === 0) {
      let attempts = 0;
      const maxAttempts = 20; // Try for 2 seconds
      const interval = setInterval(() => {
        this.voices = synth.getVoices();
        attempts++;

        if (this.voices.length > 0) {
          console.log('[TTS] Voices loaded after', attempts, 'attempts:', this.voices.length, 'voices');
          this.logAvailableVoices();
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          console.warn('[TTS] No voices loaded after', maxAttempts, 'attempts - will use browser default');
          clearInterval(interval);
        }
      }, 100);
    } else {
      this.logAvailableVoices();
    }

    // Also set up onvoiceschanged as backup (works on some browsers)
    if ('onvoiceschanged' in synth) {
      synth.onvoiceschanged = () => {
        this.voices = synth.getVoices();
        console.log('[TTS] onvoiceschanged fired:', this.voices.length, 'voices');
        this.logAvailableVoices();
      };
    }
  }

  /**
   * Log available voices for debugging
   */
  logAvailableVoices() {
    const hebrewVoices = this.voices.filter(v => {
      const lang = v.lang.toLowerCase().replace(/^iw(\b|[-_])/i, 'he$1');
      return lang.startsWith('he');
    });

    console.log('[TTS] Total voices available:', this.voices.length);
    console.log('[TTS] Hebrew voices:', hebrewVoices.length);
    if (hebrewVoices.length > 0) {
      console.log('[TTS] Hebrew voices:', hebrewVoices.map(v => `${v.name} (${v.lang})`).join(', '));
    }
  }

  /**
   * Get a fresh reference to speechSynthesis
   */
  getSynth() {
    return typeof window !== 'undefined' ? window.speechSynthesis : null;
  }

  /**
   * Detect if we're on a mobile device
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Stop any current speech and clean up
   */
  stop() {
    const synth = this.getSynth();
    if (!synth) return;

    // Only cancel if actually speaking to avoid interfering with the engine
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifyListeners('cancel');
    }

    this.currentUtterance = null;
  }

  /**
   * Get the best voice for a locale
   */
  pickVoiceForLocale(locale) {
    if (!locale) return null;

    const voices = this.voices;
    const normalizedLocale = locale.toLowerCase().replace(/^iw(\b|[-_])/i, 'he$1');
    const langCode = normalizedLocale.split('-')[0];

    // Score and sort voices
    const scored = voices
      .map((voice, index) => {
        const voiceLang = voice.lang.toLowerCase().replace(/^iw(\b|[-_])/i, 'he$1');
        const voiceLangCode = voiceLang.split('-')[0];

        let score = 0;
        if (voiceLang === normalizedLocale) score += 10;
        else if (voiceLangCode === langCode) score += 5;

        if (voice.localService) score += 2;
        if (/google/i.test(voice.name)) score += 3;
        if (/espeak/i.test(voice.name)) score -= 5;

        return { voice, score, index };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    return scored.length > 0 ? scored[0].voice : null;
  }

  /**
   * Speak native language text directly using Web Speech API
   * MUST be synchronous to preserve user gesture on mobile
   */
  speakSmart({ nativeText, nativeLocale, transliteration, mode = 'word' }) {
    console.log('[TTS] ========================================');
    console.log('[TTS] speakSmart called:', { nativeText, nativeLocale });
    console.log('[TTS] User Agent:', navigator.userAgent);
    console.log('[TTS] Is Mobile:', this.isMobile());

    // Get a FRESH reference to speechSynthesis each time
    const synth = this.getSynth();

    if (!synth) {
      console.error('[TTS] Speech synthesis not available - window.speechSynthesis is null/undefined');
      return;
    }

    console.log('[TTS] speechSynthesis object exists');
    console.log('[TTS] speechSynthesis.speaking:', synth.speaking);
    console.log('[TTS] speechSynthesis.pending:', synth.pending);
    console.log('[TTS] speechSynthesis.paused:', synth.paused);

    // Enforce minimum delay between utterances
    const now = Date.now();
    const timeSinceLastSpeak = now - this.lastSpeakTime;
    const minDelay = this.isMobile() ? 300 : 100;

    if (timeSinceLastSpeak < minDelay) {
      const waitTime = minDelay - timeSinceLastSpeak;
      console.log(`[TTS] Ignoring click - too soon (wait ${waitTime}ms more)`);
      return;
    }

    // Always cancel and clear state, but handle mobile differently
    const isMobileDevice = this.isMobile();

    // Cancel existing speech if needed
    if (synth.speaking || synth.pending) {
      console.log('[TTS] Canceling existing speech (speaking:', synth.speaking, 'pending:', synth.pending, ')');
      synth.cancel();
    }

    // Only resume if actually paused
    if (synth.paused) {
      console.log('[TTS] Engine is paused, calling resume()');
      synth.resume();
    }

    // Clear our state
    this.isSpeaking = false;
    this.currentUtterance = null;

    // Use native text directly
    const textToSpeak = nativeText;
    const locale = nativeLocale;

    if (!textToSpeak || textToSpeak === '—') {
      console.warn('[TTS] No text to speak');
      return;
    }

    console.log('[TTS] Will speak:', textToSpeak, 'in locale:', locale);

    // Use pre-loaded voices
    console.log('[TTS] Available voices count:', this.voices.length);

    if (this.voices.length === 0) {
      console.warn('[TTS] No voices loaded yet! Using browser default');
    } else {
      console.log('[TTS] First 5 voices:', this.voices.slice(0, 5).map(v => `${v.name} (${v.lang})`).join(', '));
    }

    // Find the best voice for this locale
    const voice = this.pickVoiceForLocale(locale);

    if (voice) {
      console.log('[TTS] ✓ Selected voice:', voice.name, '(', voice.lang, ')');
      console.log('[TTS] Voice details:', {
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default
      });
    } else {
      console.warn('[TTS] ⚠️ No specific voice found for locale:', locale);
      console.warn('[TTS] Will use browser default voice');
    }

    // Create a fresh utterance
    console.log('[TTS] Creating SpeechSynthesisUtterance...');
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    console.log('[TTS] ✓ Utterance created');

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
      console.log('[TTS] Set utterance.voice =', voice.name);
      console.log('[TTS] Set utterance.lang =', voice.lang);
    } else {
      utterance.lang = locale;
      console.log('[TTS] Set utterance.lang =', locale, '(no specific voice)');
    }

    utterance.rate = mode === 'sentence' ? 0.9 : 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0; // Ensure maximum volume

    console.log('[TTS] Utterance settings:', {
      text: textToSpeak.substring(0, 50),
      lang: utterance.lang,
      voice: utterance.voice?.name || 'default',
      rate: utterance.rate,
      pitch: utterance.pitch,
      volume: utterance.volume
    });

    // Track state
    this.currentUtterance = utterance;
    let started = false;
    let ended = false;

    // Set up event handlers
    console.log('[TTS] Setting up utterance event handlers...');

    utterance.onstart = () => {
      started = true;
      this.isSpeaking = true;
      this.notifyListeners('start');
      console.log('[TTS] ✅ EVENT: onstart - Audio started playing!');
    };

    utterance.onend = () => {
      ended = true;
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.notifyListeners('end');
      const duration = Date.now() - this.lastSpeakTime;
      console.log('[TTS] ✅ EVENT: onend - Finished speaking (', duration, 'ms)');
    };

    utterance.onerror = (event) => {
      ended = true;
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.error('[TTS] ❌ EVENT: onerror');
      console.error('[TTS] Error type:', event.error);
      console.error('[TTS] Error event:', event);
      this.notifyListeners('error', event.error);
    };

    utterance.onpause = () => {
      console.log('[TTS] EVENT: onpause');
    };

    utterance.onresume = () => {
      console.log('[TTS] EVENT: onresume');
    };

    utterance.onmark = (event) => {
      console.log('[TTS] EVENT: onmark', event);
    };

    utterance.onboundary = (event) => {
      console.log('[TTS] EVENT: onboundary', event);
    };

    console.log('[TTS] ✓ Event handlers attached');

    // Speak the utterance
    console.log('[TTS] >>> CALLING synth.speak() <<<');
    console.log('[TTS] Time:', new Date().toISOString());

    try {
      synth.speak(utterance);
      console.log('[TTS] ✓ synth.speak() returned without error');
      console.log('[TTS] speechSynthesis.speaking after speak():', synth.speaking);
      console.log('[TTS] speechSynthesis.pending after speak():', synth.pending);

      // On mobile, immediately set speaking state and use polling for completion
      // This is more reliable than waiting for events
      if (isMobileDevice) {
        console.log('[TTS] Mobile device - immediately setting speaking state');

        // Immediately set speaking state (don't wait for onstart)
        setTimeout(() => {
          if (!started && !ended) {
            console.log('[TTS] Force-triggering start state for mobile');
            started = true;
            this.isSpeaking = true;
            this.notifyListeners('start');
          }
        }, 50);

        // Poll for completion since events are unreliable on mobile
        const pollInterval = setInterval(() => {
          if (!synth.speaking && !synth.pending) {
            console.log('[TTS] Polling detected speech ended');
            clearInterval(pollInterval);
            if (!ended) {
              ended = true;
              this.isSpeaking = false;
              this.currentUtterance = null;
              this.notifyListeners('end');
            }
          }
        }, 100);

        // Safety timeout to stop polling after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          if (this.isSpeaking && !ended) {
            console.warn('[TTS] Safety timeout - forcing end state');
            ended = true;
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.notifyListeners('end');
          }
        }, 30000);
      } else {
        // On desktop, use a shorter timeout for missing onstart
        setTimeout(() => {
          if (!started && !ended && synth.speaking) {
            console.log('[TTS] ⚠️ onstart not fired after 200ms, manually triggering');
            started = true;
            this.isSpeaking = true;
            this.notifyListeners('start');
          }
        }, 200);
      }
    } catch (error) {
      console.error('[TTS] ❌ EXCEPTION calling synth.speak():', error);
      console.error('[TTS] Exception stack:', error.stack);
    }

    this.lastSpeakTime = Date.now();
    console.log('[TTS] ========================================');
  }

  /**
   * Pause current speech
   */
  pause() {
    const synth = this.getSynth();
    if (synth && this.isSpeaking) {
      synth.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    const synth = this.getSynth();
    if (synth && synth.paused) {
      synth.resume();
    }
  }

  /**
   * Reset playback slot (compatibility)
   */
  resetPlaybackSlot() {
    // Not needed in this simpler implementation
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking() {
    return this.isSpeaking;
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(eventType, data) {
    this.listeners.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('[TTS] Listener error:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stop();
    this.listeners.clear();
  }
}

// Export singleton
const ttsService = new TtsService();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.ttsService = ttsService;
  console.log('[TTS] Service available at window.ttsService');
}

export default ttsService;

export { TtsService };
