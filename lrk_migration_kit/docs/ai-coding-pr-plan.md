# AI Coding PR Plan for Letter River Kids

Use one PR per milestone to keep diffs reviewable.

## PR-1: Scaffold and Route Isolation
Prompt focus:
- Create app identity as Letter River Kids
- Keep only letter-learning routes
- Stub parent mode route

Acceptance:
- App boots
- No broken imports
- Existing letter-learning loop works

## PR-2: Child UI Baseline
Prompt focus:
- Increase tap targets
- Replace dense text with icon + audio cues
- Add visual progress strip

Acceptance:
- Every interactive control is child-size
- Core flow usable by pre-readers

## PR-3: Association-first Loop
Prompt focus:
- Make association mode default
- Keep sound mode as optional advanced setting
- Add adaptive hints

Acceptance:
- New learner can complete first lesson without reading text

## PR-4: Rewards and Motivation
Prompt focus:
- Replace text achievements with sticker board/unlocks
- Add positive reinforcement animation/audio

Acceptance:
- Reward event fires for each completed letter task

## PR-5: Accessibility Presets
Prompt focus:
- Add presets for motor/sensory/cognitive support
- Add quick toggles for pace/contrast/motion

Acceptance:
- Settings persist and are applied globally

## PR-6: Parent Gate and Safety
Prompt focus:
- Parent gate before settings and analytics pages
- Remove outbound links from child flow

Acceptance:
- Child cannot accidentally exit to external surfaces

## PR-7: Mastery + Spaced Review
Prompt focus:
- Track per-letter mastery
- Queue weak letters for spaced review

Acceptance:
- Review queue updates after every session

