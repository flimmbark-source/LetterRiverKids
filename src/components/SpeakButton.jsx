import { useState, useEffect, useCallback, useRef } from 'react';
import ttsService from '../lib/ttsService';

/**
 * SpeakButton Component
 *
 * A button that triggers text-to-speech for the current word or sentence.
 * Uses Web Speech API to speak native language text directly.
 *
 * Props:
 * @param {string} nativeText - Text in native script (e.g., "שלום")
 * @param {string} nativeLocale - BCP 47 locale (e.g., "he-IL", "es-ES")
 * @param {string} transliteration - Romanized text (e.g., "shalom")
 * @param {string} [variant] - "icon" | "iconWithLabel" (default: "icon")
 * @param {string} [sentenceNativeText] - Full sentence in native script (for long press)
 * @param {string} [sentenceTransliteration] - Full sentence transliteration (for long press)
 * @param {string} [className] - Additional CSS classes
 * @param {boolean} [disabled] - Disable the button
 */
export default function SpeakButton({
  nativeText,
  nativeLocale,
  transliteration,
  variant = 'icon',
  sentenceNativeText,
  sentenceTransliteration,
  className = '',
  disabled = false,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastPointerDownAt = useRef(0);

  // Subscribe to TTS events
  useEffect(() => {
    const unsubscribe = ttsService.addListener((eventType) => {
      if (eventType === 'start') {
        setIsSpeaking(true);
      } else if (eventType === 'end' || eventType === 'cancel' || eventType === 'error') {
        setIsSpeaking(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  // Simple speak function
  const speak = useCallback(() => {
    console.log('[SpeakButton] speak() called');
    console.log('[SpeakButton] disabled:', disabled, 'nativeText:', nativeText);

    if (disabled || !nativeText) {
      console.warn('[SpeakButton] Skipping speak - disabled or no text');
      return;
    }

    console.log('[SpeakButton] Calling ttsService.speakSmart()...');
    ttsService.speakSmart({
      nativeText,
      nativeLocale,
      transliteration,
      mode: 'word',
    });
    console.log('[SpeakButton] ttsService.speakSmart() returned');
  }, [nativeText, nativeLocale, transliteration, disabled]);

  // Handle click events
  const handlePointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    lastPointerDownAt.current = Date.now();
    event.stopPropagation();
    speak();
  }, [speak]);

  const handleTouchStart = useCallback((event) => {
    if (Date.now() - lastPointerDownAt.current < 200) {
      return;
    }

    lastPointerDownAt.current = Date.now();
    event.stopPropagation();
    speak();
  }, [speak]);

  // Handle click events (desktop + keyboard activation)
  const handleClick = useCallback((event) => {
    if (Date.now() - lastPointerDownAt.current < 700) {
      return;
    }

    event.stopPropagation();

  // Button styles
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    rounded-lg border border-slate-700 bg-slate-800/50
    font-medium text-slate-200
    transition-all duration-150
    hover:bg-slate-700 hover:border-slate-600
    active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50
  `;

  const sizeStyles = variant === 'iconWithLabel'
    ? 'px-3 py-2 text-sm'
    : 'p-2 text-base';

  const speakingStyles = isSpeaking
    ? 'bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/50'
    : '';

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles} ${speakingStyles} ${className}`}
      style={{
        // Hit slop for better touch targets
        minWidth: '40px',
        minHeight: '40px',
      }}
      aria-label={variant === 'icon' ? 'Speak text' : undefined}
      title="Speak word"
    >
      {/* Speaker Icon */}
      <span className={`text-lg ${isSpeaking ? 'animate-pulse' : ''}`}>
        {isSpeaking ? '🔊' : '🔈'}
      </span>

      {/* Label (only for iconWithLabel variant) */}
      {variant === 'iconWithLabel' && (
        <span>{isSpeaking ? 'Speaking...' : 'Speak'}</span>
      )}
    </button>
  );
}
