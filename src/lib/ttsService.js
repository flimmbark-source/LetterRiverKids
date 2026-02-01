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
    this.hasSuccessfullySpoken = false; // Track if we've ever heard onstart event

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
    // We'll unlock audio in speakSmart() instead, to ensure it's in the same user gesture
    console.log('[TTS] Audio unlock will happen on first speak() call');
  }

  /**
   * Try to unlock audio context synchronously within a user gesture
   * Must be called from a user interaction event handler
   */
  tryUnlockAudio() {
    // Mark as unlocked - we'll just speak the real text directly
    // Speaking any utterance in a user gesture should unlock audio
    this.audioUnlocked = true;
    console.log('[TTS] First speak - will unlock audio with actual utterance');
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

    // FIRST: Try to unlock audio on mobile (must happen in user gesture context)
    if (this.isMobile() && !this.audioUnlocked) {
      this.tryUnlockAudio();
      // Give the unlock utterance a moment to process before continuing
      // This is critical on mobile browsers
      console.log('[TTS] Waiting 100ms for audio unlock to settle...');
    }

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
    const isMobileDevice = this.isMobile();
    const minDelay = isMobileDevice ? 300 : 100;

    if (timeSinceLastSpeak < minDelay) {
      const waitTime = minDelay - timeSinceLastSpeak;
      console.log(`[TTS] Ignoring click - too soon (wait ${waitTime}ms more)`);
      return;
    }

    // CRITICAL FOR MOBILE: On mobile, DO NOT call cancel() before the first speak()
    // Calling cancel() or any other synth method breaks the user gesture chain
    // Only call cancel() on desktop, or on mobile after audio is already unlocked and playing
    if (isMobileDevice) {
      // On mobile: only cancel if we're already speaking AND audio has been successfully unlocked before
      if (this.audioUnlocked && this.lastSpeakTime > 0 && (synth.speaking || synth.pending)) {
        console.log('[TTS] [MOBILE] Canceling existing speech');
        synth.cancel();
      } else {
        console.log('[TTS] [MOBILE] Skipping cancel to preserve user gesture');
      }
      // Never call resume() on mobile - it can cause issues
    } else {
      // On desktop, cancel and resume as needed
      if (synth.speaking || synth.pending) {
        console.log('[TTS] Canceling existing speech (speaking:', synth.speaking, 'pending:', synth.pending, ')');
        synth.cancel();
      }

      if (synth.paused) {
        console.log('[TTS] Engine is paused, calling resume()');
        synth.resume();
      }
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

    // CRITICAL: Re-fetch voices right before speaking to ensure they're fresh
    // On some mobile browsers, voices can become stale or the engine needs a fresh getVoices() call
    const freshVoices = synth.getVoices();
    if (freshVoices.length > 0) {
      this.voices = freshVoices;
      console.log('[TTS] Refreshed voices - got', freshVoices.length, 'voices');
    }

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

    // CRITICAL FOR MOBILE: Setting utterance.voice can cause issues on some Android browsers
    // On mobile, just set the lang and let the browser pick the voice
    if (isMobileDevice) {
      utterance.lang = locale;
      console.log('[TTS] [MOBILE] Set utterance.lang =', locale, '(letting browser choose voice)');
      if (voice) {
        console.log('[TTS] [MOBILE] Found voice but not setting it:', voice.name);
      }
    } else {
      // On desktop, set the voice normally
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
        console.log('[TTS] Set utterance.voice =', voice.name);
        console.log('[TTS] Set utterance.lang =', voice.lang);
      } else {
        utterance.lang = locale;
        console.log('[TTS] Set utterance.lang =', locale, '(no specific voice)');
      }
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
      this.hasSuccessfullySpoken = true; // Mark that we've successfully played audio
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

      // On mobile, use polling and optional retry for stuck speech
      if (isMobileDevice) {
        console.log('[TTS] Mobile device - using mobile-specific event handling');

        // Only use retry mechanism if we've successfully spoken before
        // First speak (globally) needs to be pure to unlock audio
        // After that, only retry if we've confirmed audio works (onstart fired at least once)
        if (this.hasSuccessfullySpoken) {
          // Check if onstart fires within 150ms, if not, cancel and retry
          setTimeout(() => {
            if (!started && !ended) {
              console.warn('[TTS] ⚠️ onstart did not fire - speech may be stuck!');
              console.log('[TTS] Attempting workaround: cancel and speak again');

              // Cancel the stuck utterance
              synth.cancel();

              // Speak again immediately
              setTimeout(() => {
                console.log('[TTS] Retrying speak with same utterance...');
                const retry = new SpeechSynthesisUtterance(textToSpeak);

                // CRITICAL: On mobile, never set voice object, even in retry
                // Just set lang and let browser choose
                retry.lang = locale;
                console.log('[TTS] [RETRY] Set retry.lang =', locale);

                retry.rate = utterance.rate;
                retry.pitch = utterance.pitch;
                retry.volume = utterance.volume;

                // Set up minimal event handlers for retry
                retry.onstart = () => {
                  console.log('[TTS] ✅ RETRY onstart fired!');
                  started = true;
                  this.isSpeaking = true;
                  this.hasSuccessfullySpoken = true;
                  this.notifyListeners('start');
                };

                retry.onend = () => {
                  console.log('[TTS] ✅ RETRY onend fired');
                  ended = true;
                  this.isSpeaking = false;
                  this.currentUtterance = null;
                  this.notifyListeners('end');
                };

                retry.onerror = (event) => {
                  console.error('[TTS] ❌ RETRY onerror:', event.error);
                  ended = true;
                  this.isSpeaking = false;
                  this.currentUtterance = null;
                  this.notifyListeners('error', event.error);
                };

                synth.speak(retry);
                this.currentUtterance = retry;
                console.log('[TTS] Retry speak() called');
              }, 50);
            } else {
              console.log('[TTS] onstart fired successfully, no retry needed');
            }
          }, 150);
        } else {
          console.log('[TTS] Never successfully spoken before - no retry, keeping it pure');
        }

        // Force-trigger UI update earlier so button shows as speaking
        setTimeout(() => {
          if (!started && !ended && synth.speaking) {
            console.log('[TTS] Force-triggering UI update');
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
