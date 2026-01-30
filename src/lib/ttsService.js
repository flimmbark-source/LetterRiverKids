/**
 * TTS Service using HTML5 Audio with Google Translate TTS
 *
 * This implementation uses HTML5 Audio for reliable mobile playback:
 * - Uses Google Translate TTS API for audio generation
 * - Works reliably on all mobile browsers
 * - No autoplay restrictions or gesture chain issues
 * - Graceful fallback to transliteration when needed
 */

class TtsService {
  constructor() {
    this.currentAudio = null;
    this.listeners = new Set();
    this.isSpeaking = false;
    this.lastSpeakTime = 0;

    // Track locales that have failed and should use transliteration
    this.forceTranslitForLocale = this.loadTranslitPreferences();
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
   * Build Google Translate TTS URL
   */
  buildTtsUrl(text, locale) {
    // Google Translate TTS API
    const baseUrl = 'https://translate.google.com/translate_tts';
    const params = new URLSearchParams({
      ie: 'UTF-8',
      tl: locale.split('-')[0], // Just use language code (he, en, es, etc.)
      client: 'tw-ob',
      q: text,
    });
    return `${baseUrl}?${params.toString()}`;
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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifyListeners('cancel');
    }
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
   * Smart speak: tries native voice with Google TTS, falls back to transliteration
   * Uses HTML5 Audio for reliable mobile playback
   */
  speakSmart({ nativeText, nativeLocale, transliteration, mode = 'word' }) {
    console.log('[TTS] speakSmart called:', { nativeText, nativeLocale, transliteration });

    // On mobile, enforce a minimum delay between utterances
    const now = Date.now();
    const timeSinceLastSpeak = now - this.lastSpeakTime;
    const minDelay = this.isMobile() ? 300 : 100;

    if (timeSinceLastSpeak < minDelay) {
      const waitTime = minDelay - timeSinceLastSpeak;
      console.log(`[TTS] Ignoring click - too soon (wait ${waitTime}ms more)`);
      return;
    }

    // Stop any current audio
    this.stop();

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
    if (this.forceTranslitForLocale[locale] && transliteration && locale !== 'en-US') {
      console.log('[TTS] Using transliteration (saved preference for', locale, ')');
      textToSpeak = this.normalizeTranslit(transliteration);
      locale = 'en-US';
    }

    // Build the TTS URL
    const ttsUrl = this.buildTtsUrl(textToSpeak, locale);
    console.log('[TTS] Audio URL:', ttsUrl);

    // Create and configure audio element
    const audio = new Audio(ttsUrl);
    this.currentAudio = audio;

    // Track timing for fallback detection
    const startTime = Date.now();
    let hasStarted = false;

    // Set up event handlers
    audio.onloadstart = () => {
      console.log('[TTS] Audio loading started');
    };

    audio.oncanplay = () => {
      console.log('[TTS] Audio can play');
    };

    audio.onplay = () => {
      hasStarted = true;
      this.isSpeaking = true;
      this.notifyListeners('start');
      console.log('[TTS] ✓ Started playing audio');
    };

    audio.onended = () => {
      const duration = Date.now() - startTime;
      this.isSpeaking = false;
      this.currentAudio = null;
      this.notifyListeners('end');
      console.log('[TTS] ✓ Finished playing audio (', duration, 'ms)');
    };

    audio.onerror = (event) => {
      const duration = Date.now() - startTime;
      this.isSpeaking = false;
      this.currentAudio = null;
      console.error('[TTS] ✗ Audio error:', audio.error);
      this.notifyListeners('error', audio.error);

      // Try English fallback if this was a foreign language
      if (locale !== 'en-US' && transliteration && !this.forceTranslitForLocale[nativeLocale]) {
        console.log('[TTS] Audio failed, trying English transliteration fallback...');
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

    audio.onpause = () => {
      console.log('[TTS] Audio paused');
    };

    audio.onabort = () => {
      this.isSpeaking = false;
      this.currentAudio = null;
      this.notifyListeners('cancel');
      console.log('[TTS] Audio aborted');
    };

    // Start playback
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[TTS] Audio play() promise resolved');
        })
        .catch((error) => {
          console.error('[TTS] Audio play() promise rejected:', error);
          this.isSpeaking = false;
          this.currentAudio = null;
          this.notifyListeners('error', error);

          // Try English fallback
          if (locale !== 'en-US' && transliteration && !this.forceTranslitForLocale[nativeLocale]) {
            console.log('[TTS] Play rejected, trying English transliteration fallback...');
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
        });
    }

    this.lastSpeakTime = Date.now();

    // Safety timeout: if audio didn't start after 3 seconds, assume it failed
    setTimeout(() => {
      if (!hasStarted && this.currentAudio === audio) {
        console.warn('[TTS] Audio did not start within 3 seconds');
        this.isSpeaking = false;
        this.notifyListeners('error', 'timeout');

        // Try English fallback
        if (locale !== 'en-US' && transliteration && !this.forceTranslitForLocale[nativeLocale]) {
          console.log('[TTS] Timeout, trying English transliteration fallback...');
          this.saveTranslitPreference(nativeLocale, true);
          this.speakSmart({
            nativeText: this.normalizeTranslit(transliteration),
            nativeLocale: 'en-US',
            transliteration,
            mode
          });
        }
      }
    }, 3000);
  }

  /**
   * Pause current speech
   */
  pause() {
    if (this.currentAudio && this.isSpeaking) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
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
