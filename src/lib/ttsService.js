/**
 * TTS Service using Web Speech API with improved mobile reliability
 *
 * This implementation uses a hybrid approach:
 * - Desktop: Native language voices (e.g., Hebrew) for authentic pronunciation
 * - Mobile: English transliteration by default for better reliability
 * - Always creates fresh utterances to prevent stuck state
 * - Minimal state management to avoid corruption
 * - Delays between utterances to let the engine reset
 * - Automatic fallback chain when voices fail
 *
 * Mobile browsers often have limited or no support for non-English voices,
 * so we default to English pronunciation of transliterations on mobile.
 * Users can override this by calling resetTransliterationFor(locale) if
 * their mobile browser supports the native language voice.
 */

class TtsService {
  constructor() {
    this.currentUtterance = null;
    this.listeners = new Set();
    this.isSpeaking = false;
    this.lastSpeakTime = 0;
    this.voicesLoaded = false;
    this.voiceLoadCallbacks = [];

    // Track locales that have failed and should use transliteration
    this.forceTranslitForLocale = this.loadTranslitPreferences();

    // Initialize voice loading
    this.initVoiceLoading();
  }

  /**
   * Load transliteration preferences from localStorage
   */
  loadTranslitPreferences() {
    try {
      const stored = localStorage.getItem('tts_force_translit');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Save that a locale should use transliteration
   */
  saveTranslitPreference(locale, useTranslit) {
    try {
      this.forceTranslitForLocale[locale] = useTranslit;
      localStorage.setItem('tts_force_translit', JSON.stringify(this.forceTranslitForLocale));
      console.log('[TTS] Saved preference: use transliteration for', locale);
    } catch (e) {
      console.warn('[TTS] Could not save preference:', e);
    }
  }

  /**
   * Initialize voice loading - voices may load asynchronously
   */
  initVoiceLoading() {
    const synth = this.getSynth();
    if (!synth) return;

    // Check if voices are already available
    const voices = synth.getVoices();
    if (voices.length > 0) {
      console.log('[TTS] Voices already loaded:', voices.length);
      this.voicesLoaded = true;
      this.logAvailableVoices();
      return;
    }

    // Listen for voices to load
    if ('onvoiceschanged' in synth) {
      synth.onvoiceschanged = () => {
        const newVoices = synth.getVoices();
        console.log('[TTS] Voices loaded:', newVoices.length);
        this.voicesLoaded = true;
        this.logAvailableVoices();

        // Notify any waiting callbacks
        this.voiceLoadCallbacks.forEach(cb => cb());
        this.voiceLoadCallbacks = [];
      };
    } else {
      // Fallback: assume voices are available immediately
      this.voicesLoaded = true;
    }
  }

  /**
   * Log available voices for debugging
   */
  logAvailableVoices() {
    const synth = this.getSynth();
    if (!synth) return;

    const voices = synth.getVoices();
    const hebrewVoices = voices.filter(v => {
      const lang = v.lang.toLowerCase().replace(/^iw(\b|[-_])/i, 'he$1');
      return lang.startsWith('he');
    });

    console.log('[TTS] Total voices available:', voices.length);
    console.log('[TTS] Hebrew voices:', hebrewVoices.length);
    if (hebrewVoices.length > 0) {
      console.log('[TTS] Hebrew voices:', hebrewVoices.map(v => `${v.name} (${v.lang})`).join(', '));
    }
  }

  /**
   * Get a fresh reference to speechSynthesis
   * Like creating a new Audio() object - prevents stuck state on mobile
   */
  getSynth() {
    return typeof window !== 'undefined' ? window.speechSynthesis : null;
  }

  /**
   * Initialize the TTS service
   */
  initTts() {
    const synth = this.getSynth();
    if (!synth) {
      console.warn('[TTS] Speech Synthesis not available');
      return Promise.resolve();
    }
    return Promise.resolve();
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
   * Normalize transliteration for better pronunciation
   */
  normalizeTranslit(text) {
    if (!text) return '';
    return text
      .trim()
      .replace(/'/g, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get the best voice for a locale
   */
  pickVoiceForLocale(locale, synth) {
    if (!synth || !locale) return null;

    const voices = synth.getVoices();
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
   * Smart speak: tries native voice, falls back to transliteration
   * MUST be synchronous to preserve user gesture on mobile
   */
  speakSmart({ nativeText, nativeLocale, transliteration, mode = 'word' }) {
    console.log('[TTS] speakSmart called:', { nativeText, nativeLocale, transliteration });

    // Get a FRESH reference to speechSynthesis each time (issue #3)
    // Like creating new Audio() object - prevents stuck state on mobile
    const synth = this.getSynth();

    if (!synth) {
      console.warn('[TTS] Speech synthesis not available');
      return;
    }

    // On mobile, enforce a minimum delay between utterances to let engine reset
    // Return early if too soon (don't use await - it breaks user gesture!)
    const now = Date.now();
    const timeSinceLastSpeak = now - this.lastSpeakTime;
    const minDelay = this.isMobile() ? 300 : 100;

    if (timeSinceLastSpeak < minDelay) {
      const waitTime = minDelay - timeSinceLastSpeak;
      console.log(`[TTS] Ignoring click - too soon (wait ${waitTime}ms more)`);
      return; // Don't wait, just ignore the click
    }

    // Only cancel if there's something to cancel (prevents breaking the engine)
    // Calling cancel() on an idle engine can cause it to enter a broken state on Android
    if (synth.speaking || synth.pending) {
      console.log('[TTS] Canceling existing speech');
      synth.cancel();
    }

    // Only resume if actually paused (calling resume() on non-paused engine may break it)
    if (synth.paused) {
      console.log('[TTS] Engine is paused, calling resume()');
      synth.resume();
    }

    // Clear our state
    this.isSpeaking = false;
    this.currentUtterance = null;

    // Determine what to speak
    let textToSpeak = nativeText;
    let locale = nativeLocale;

    if (!textToSpeak || textToSpeak === '—') {
      if (transliteration) {
        textToSpeak = this.normalizeTranslit(transliteration);
        locale = 'en-US';
      } else {
        console.warn('[TTS] No text to speak');
        return;
      }
    }

    console.log('[TTS] Will speak:', textToSpeak, 'in locale:', locale);

    // Check if we should force transliteration for this locale
    if (this.forceTranslitForLocale[locale] === true && transliteration && locale !== 'en-US') {
      console.log('[TTS] Using transliteration (saved preference for', locale, ')');
      textToSpeak = this.normalizeTranslit(transliteration);
      locale = 'en-US';
    }

    // MOBILE OPTIMIZATION: On mobile, prefer transliteration (English) from the start
    // English voices are more reliably available on mobile browsers
    // Only do this if there's no explicit saved preference (undefined)
    if (this.isMobile() && locale !== 'en-US' && transliteration &&
        this.forceTranslitForLocale[locale] === undefined) {
      console.log('[TTS] Mobile detected - using transliteration for better reliability');
      textToSpeak = this.normalizeTranslit(transliteration);
      locale = 'en-US';
    }

    // Get voices - if not loaded yet, use default voice
    // We can't wait for voices without breaking the user gesture
    const voices = synth.getVoices();

    if (voices.length === 0) {
      console.log('[TTS] Voices not loaded yet, using default');
    }

    // Find the best voice for this locale
    const voice = this.pickVoiceForLocale(locale, synth);

    if (voice) {
      console.log('[TTS] Selected voice:', voice.name, '(', voice.lang, ')');
    } else {
      console.log('[TTS] No specific voice found, using browser default for locale:', locale);
    }

    // Create a fresh utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
      console.log('[TTS] Using voice:', voice.name, 'with lang:', voice.lang);
    } else {
      utterance.lang = locale;
      console.log('[TTS] Using default voice with lang:', locale);
    }

    utterance.rate = mode === 'sentence' ? 0.9 : 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Track state
    this.currentUtterance = utterance;
    let started = false;
    let ended = false;

    // Set up event handlers
    utterance.onstart = () => {
      started = true;
      this.isSpeaking = true;
      this.notifyListeners('start');
      console.log('[TTS] ✓ Started speaking');
    };

    utterance.onend = () => {
      ended = true;
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.notifyListeners('end');

      // Check if it finished suspiciously quickly (probably didn't play)
      const duration = Date.now() - this.lastSpeakTime;
      if (!started || duration < 100) {
        console.warn('[TTS] ⚠️ Finished too quickly (', duration, 'ms), probably did not play audio');

        // Try fallback to transliteration if we haven't already and this was a non-English voice
        if (locale !== 'en-US' && transliteration && !this.forceTranslitForLocale[nativeLocale]) {
          console.log('[TTS] Retrying with English transliteration fallback...');
          // Save preference to use transliteration for this locale in the future
          this.saveTranslitPreference(nativeLocale, true);
          setTimeout(() => {
            this.speakSmart({
              nativeText: this.normalizeTranslit(transliteration),
              nativeLocale: 'en-US',
              transliteration,
              mode
            });
          }, 100);
        }
      } else {
        console.log('[TTS] ✓ Finished speaking (', duration, 'ms)');
      }
    };

    utterance.onerror = (event) => {
      ended = true;
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.error('[TTS] ✗ Error:', event.error);
      this.notifyListeners('error', event.error);

      // Try English fallback if appropriate
      if (event.error === 'language-unavailable' && locale !== 'en-US' && transliteration) {
        console.log('[TTS] Language unavailable, trying English fallback...');
        // Save preference to use transliteration for this locale in the future
        this.saveTranslitPreference(nativeLocale, true);
        setTimeout(() => {
          this.speakSmart({
            nativeText: this.normalizeTranslit(transliteration),
            nativeLocale: 'en-US',
            transliteration,
            mode
          });
        }, 100);
      }
    };

    // Speak the utterance
    console.log('[TTS] Calling synth.speak()...');
    synth.speak(utterance);
    this.lastSpeakTime = Date.now();

    // Safety timeout: if speaking didn't start after 2 seconds, assume it failed
    setTimeout(() => {
      if (!started && !ended) {
        console.warn('[TTS] Speech did not start within 2 seconds');
        this.isSpeaking = false;
        this.notifyListeners('error', 'timeout');
      }
    }, 2000);
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
   * Force using transliteration for a locale (useful when native voice fails silently)
   */
  useTransliterationFor(locale) {
    console.log('[TTS] Manually enabling transliteration for', locale);
    this.saveTranslitPreference(locale, true);
  }

  /**
   * Reset transliteration preference for a locale (try native voice again)
   */
  resetTransliterationFor(locale) {
    console.log('[TTS] Resetting transliteration preference for', locale);
    this.saveTranslitPreference(locale, false);
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
  console.log('[TTS] To force transliteration: window.ttsService.useTransliterationFor("he-IL")');
  console.log('[TTS] To reset: window.ttsService.resetTransliterationFor("he-IL")');
}

export default ttsService;

export { TtsService };
