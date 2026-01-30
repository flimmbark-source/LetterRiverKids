/**
 * TTS Service using Web Speech API
 *
 * Simple implementation that speaks native language text directly:
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
    this.voicesLoaded = false;
    this.voiceLoadCallbacks = [];

    // Initialize voice loading
    this.initVoiceLoading();
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
   * Speak native language text directly using Web Speech API
   * MUST be synchronous to preserve user gesture on mobile
   */
  speakSmart({ nativeText, nativeLocale, transliteration, mode = 'word' }) {
    console.log('[TTS] speakSmart called:', { nativeText, nativeLocale });

    // Get a FRESH reference to speechSynthesis each time
    const synth = this.getSynth();

    if (!synth) {
      console.warn('[TTS] Speech synthesis not available');
      return;
    }

    // Enforce minimum delay between utterances
    const now = Date.now();
    const timeSinceLastSpeak = now - this.lastSpeakTime;
    const minDelay = this.isMobile() ? 300 : 100;

    if (timeSinceLastSpeak < minDelay) {
      const waitTime = minDelay - timeSinceLastSpeak;
      console.log(`[TTS] Ignoring click - too soon (wait ${waitTime}ms more)`);
      return;
    }

    // Only cancel if there's something to cancel
    if (synth.speaking || synth.pending) {
      console.log('[TTS] Canceling existing speech');
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
      const duration = Date.now() - this.lastSpeakTime;
      console.log('[TTS] ✓ Finished speaking (', duration, 'ms)');
    };

    utterance.onerror = (event) => {
      ended = true;
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.error('[TTS] ✗ Error:', event.error);
      this.notifyListeners('error', event.error);
    };

    // Speak the utterance
    console.log('[TTS] Calling synth.speak()...');
    synth.speak(utterance);
    this.lastSpeakTime = Date.now();
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
