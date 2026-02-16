import React, { useState, useEffect } from 'react';
import { useProgress } from '../context/ProgressContext.jsx';
import { useLocalization } from '../context/LocalizationContext.jsx';
import { useKidMode } from '../hooks/useKidMode.js';
import ttsService from '../lib/ttsService.js';

/**
 * Kid-friendly onboarding component
 * Shows welcome, age selection, and character/track selection
 */
export default function KidOnboarding() {
  const { completeKidOnboarding } = useProgress();
  const { updateKidSettings, onboardingComplete, ageBand, track } = useKidMode();
  const { t } = useLocalization();

  const [step, setStep] = useState(1); // 1=welcome, 2=age, 3=track, 4=ready
  const [selectedAge, setSelectedAge] = useState(ageBand);
  const [selectedTrack, setSelectedTrack] = useState(track);

  // Don't show if onboarding already complete
  if (onboardingComplete) return null;

  const handleAgeSelect = (age) => {
    setSelectedAge(age);
    // Auto-speak age selection
    const ageText = age === '4-6' ? 'Ages 4 to 6' : 'Ages 7 to 9';
    ttsService.speakSmart({
      nativeText: ageText,
      nativeLocale: 'en-US',
      mode: 'word'
    });
  };

  const handleTrackSelect = (trackType) => {
    setSelectedTrack(trackType);
    // Auto-speak track selection
    const trackText = trackType === 'explorer' ? 'Explorer' : 'Builder';
    ttsService.speakSmart({
      nativeText: trackText,
      nativeLocale: 'en-US',
      mode: 'word'
    });
  };

  const handleComplete = () => {
    // Save settings
    updateKidSettings({
      ageBand: selectedAge,
      track: selectedTrack
    });
    completeKidOnboarding();
  };

  const handleStepChange = (nextStep) => {
    setStep(nextStep);
    // Announce step change
    if (nextStep === 2) {
      setTimeout(() => {
        ttsService.speakSmart({
          nativeText: 'How old are you? Tap your age.',
          nativeLocale: 'en-US',
          mode: 'sentence'
        });
      }, 300);
    } else if (nextStep === 3) {
      setTimeout(() => {
        ttsService.speakSmart({
          nativeText: 'Choose your learning buddy!',
          nativeLocale: 'en-US',
          mode: 'sentence'
        });
      }, 300);
    }
  };

  // Welcome step
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{
        background: 'linear-gradient(135deg, #E8F5FF 0%, #FFF5E8 100%)'
      }}>
        <div className="w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl" style={{
          background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
          border: '4px solid #A7F3D0'
        }}>
          <div className="text-8xl mb-4">🌊</div>
          <h1 className="text-4xl font-bold mb-4" style={{
            fontFamily: '"Baloo 2", system-ui, sans-serif',
            color: '#2563eb'
          }}>
            Welcome to<br/>Letter River!
          </h1>
          <p className="text-xl mb-8" style={{ color: '#4b5563' }}>
            Let's start learning letters together!
          </p>
          <button
            onClick={() => handleStepChange(2)}
            className="w-full rounded-full px-8 py-4 text-2xl font-bold shadow-lg transition-all active:translate-y-1"
            style={{
              border: 0,
              fontFamily: '"Nunito", system-ui, sans-serif',
              color: '#ffffff',
              background: 'radial-gradient(circle at 20% 0, #60a5fa 0, #3b82f6 40%, #2563eb 100%)',
              boxShadow: '0 6px 0 #1e40af, 0 10px 20px rgba(30, 64, 175, 0.5)'
            }}
          >
            Let's Go! 🚀
          </button>
        </div>
      </div>
    );
  }

  // Age selection step
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{
        background: 'linear-gradient(135deg, #E8F5FF 0%, #FFF5E8 100%)'
      }}>
        <div className="w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl" style={{
          background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
          border: '4px solid #A7F3D0'
        }}>
          <h2 className="text-3xl font-bold mb-6" style={{
            fontFamily: '"Baloo 2", system-ui, sans-serif',
            color: '#2563eb'
          }}>
            How old are you?
          </h2>
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => handleAgeSelect('4-6')}
              className={`flex-1 rounded-2xl p-6 text-xl font-bold shadow-lg transition-all ${selectedAge === '4-6' ? 'ring-4 ring-green-500' : ''}`}
              style={{
                border: '3px solid #93c5fd',
                background: selectedAge === '4-6' ? '#dbeafe' : '#eff6ff',
                color: '#1e40af'
              }}
            >
              <div className="text-5xl mb-2">👶</div>
              Ages 4-6
            </button>
            <button
              onClick={() => handleAgeSelect('7-9')}
              className={`flex-1 rounded-2xl p-6 text-xl font-bold shadow-lg transition-all ${selectedAge === '7-9' ? 'ring-4 ring-green-500' : ''}`}
              style={{
                border: '3px solid #93c5fd',
                background: selectedAge === '7-9' ? '#dbeafe' : '#eff6ff',
                color: '#1e40af'
              }}
            >
              <div className="text-5xl mb-2">🧒</div>
              Ages 7-9
            </button>
          </div>
          <button
            onClick={() => handleStepChange(3)}
            disabled={!selectedAge}
            className="w-full rounded-full px-8 py-4 text-xl font-bold shadow-lg transition-all active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              border: 0,
              fontFamily: '"Nunito", system-ui, sans-serif',
              color: '#ffffff',
              background: 'radial-gradient(circle at 20% 0, #60a5fa 0, #3b82f6 40%, #2563eb 100%)',
              boxShadow: '0 6px 0 #1e40af, 0 10px 20px rgba(30, 64, 175, 0.5)'
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // Track selection step
  if (step === 3) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{
        background: 'linear-gradient(135deg, #E8F5FF 0%, #FFF5E8 100%)'
      }}>
        <div className="w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl" style={{
          background: 'linear-gradient(135deg, #fffcea 0%, #fcfff2 100%)',
          border: '4px solid #A7F3D0'
        }}>
          <h2 className="text-3xl font-bold mb-4" style={{
            fontFamily: '"Baloo 2", system-ui, sans-serif',
            color: '#2563eb'
          }}>
            Choose Your Buddy!
          </h2>
          <p className="text-lg mb-6" style={{ color: '#4b5563' }}>
            Who will help you learn?
          </p>
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => handleTrackSelect('explorer')}
              className={`flex-1 rounded-2xl p-6 text-lg font-bold shadow-lg transition-all ${selectedTrack === 'explorer' ? 'ring-4 ring-green-500' : ''}`}
              style={{
                border: '3px solid #fcd34d',
                background: selectedTrack === 'explorer' ? '#fef3c7' : '#fffbeb',
                color: '#92400e'
              }}
            >
              <div className="text-6xl mb-2">🧒</div>
              Explorer
              <div className="text-sm mt-2 opacity-75">Learn by discovering!</div>
            </button>
            <button
              onClick={() => handleTrackSelect('builder')}
              className={`flex-1 rounded-2xl p-6 text-lg font-bold shadow-lg transition-all ${selectedTrack === 'builder' ? 'ring-4 ring-green-500' : ''}`}
              style={{
                border: '3px solid #fcd34d',
                background: selectedTrack === 'builder' ? '#fef3c7' : '#fffbeb',
                color: '#92400e'
              }}
            >
              <div className="text-6xl mb-2">👷</div>
              Builder
              <div className="text-sm mt-2 opacity-75">Learn by creating!</div>
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-full px-6 py-4 text-lg font-bold shadow transition-all"
              style={{
                border: '2px solid #93c5fd',
                background: '#eff6ff',
                color: '#1e40af'
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleComplete}
              disabled={!selectedTrack}
              className="flex-1 rounded-full px-6 py-4 text-lg font-bold shadow-lg transition-all active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                border: 0,
                fontFamily: '"Nunito", system-ui, sans-serif',
                color: '#ffffff',
                background: 'radial-gradient(circle at 20% 0, #34d399 0, #10b981 40%, #059669 100%)',
                boxShadow: '0 6px 0 #047857, 0 10px 20px rgba(4, 120, 87, 0.5)'
              }}
            >
              Start Learning! 🎉
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
