import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * FloatingCapsulesGame - A word-matching mini-game with floating capsules
 *
 * Players drag Hebrew, transliteration, or meaning capsules onto their matching partners.
 * Capsules float gently like leaves on water with connecting lines shown at start.
 */

const PREVIEW_DURATION = 3000; // Show lines for 3 seconds
const FADE_DURATION = 1000; // Fade lines over 1 second
const CAPSULE_RADIUS = 40; // Hit detection radius
const BOUNCE_DAMPING = 0.7; // Velocity reduction on bounce
const LINE_OF_SIGHT_BUFFER = 65; // Clearance for matched capsules
const CAPSULE_CLEARANCE_BUFFER = 14; // Extra spacing to avoid overlaps

export default function FloatingCapsulesGame({ wordPairs, onComplete }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'completed'
  const [mismatchCount, setMismatchCount] = useState(0);
  const [completionTime, setCompletionTime] = useState(0);
  const [showLines, setShowLines] = useState(true);
  const [currentHintPairIndex, setCurrentHintPairIndex] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [, forceUpdate] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Capsule state
  const capsulesRef = useRef([]);
  const [ghostPairs, setGhostPairs] = useState([]);
  const initializedWordPairsRef = useRef(null);

  // Drag state
  const dragStateRef = useRef({
    isDragging: false,
    capsuleIndex: -1,
    offsetX: 0,
    offsetY: 0
  });

  const playAreaRef = useRef(null);
  const [playAreaBounds, setPlayAreaBounds] = useState({ width: 0, height: 0 });

  // Measure bounds accurately after layout is complete
  const updateBounds = useCallback(() => {
    if (!playAreaRef.current) return;

    // Double requestAnimationFrame ensures layout is 100% complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (playAreaRef.current) {
          const bounds = playAreaRef.current.getBoundingClientRect();
          setPlayAreaBounds({ width: bounds.width, height: bounds.height });
        }
      });
    });
  }, []);

  // Update bounds on window resize
  useEffect(() => {
    updateBounds();

    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [updateBounds]);

  // Initialize capsules with well-distributed positions
  useEffect(() => {
    if (!playAreaRef.current || playAreaBounds.width === 0) return;

    // Only reinitialize if wordPairs actually changed (not just bounds)
    if (initializedWordPairsRef.current === wordPairs) return;
    initializedWordPairsRef.current = wordPairs;

    const bounds = playAreaBounds;

    // Ensure we have unique pairs (handle duplicates by adding disambiguation)
    const uniquePairs = ensureUniquePairs(wordPairs);

    const capsules = [];
    const padding = 2; // Very minimal padding at edges
    const bottomReservedSpace = 68; // Space for hint button (16px bottom + ~44px button height + 8px padding)
    const usableWidth = bounds.width - padding * 2;
    const usableHeight = bounds.height - padding - bottomReservedSpace;

    const measurementCanvas = document.createElement('canvas');
    const measurementContext = measurementCanvas.getContext('2d');
    const getCapsuleRadius = (text, isHebrew) => {
      if (!measurementContext) {
        return CAPSULE_RADIUS;
      }
      const fontSize = isHebrew ? 18 : 16;
      const fontFamily = isHebrew ? '"Noto Sans Hebrew", "Arial", sans-serif' : '"Inter", "Arial", sans-serif';
      measurementContext.font = `600 ${fontSize}px ${fontFamily}`;
      const textWidth = measurementContext.measureText(text).width;
      const width = textWidth + 32;
      const height = fontSize + 16;
      // Use actual visual size without extra buffer
      return Math.max(width, height) / 2;
    };

    // Helper to check if position is too close to existing capsules
    const isTooClose = (x, y, radius, existingCapsules) => {
      return existingCapsules.some(cap => {
        const dx = cap.x - x;
        const dy = cap.y - y;
        // Just use the actual radii, no extra buffer
        const minDistance = radius + (cap.radius ?? CAPSULE_RADIUS);
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });
    };

    const isWithinBounds = (x, y) => {
      return (
        x >= padding &&
        x <= bounds.width - padding &&
        y >= padding &&
        y <= bounds.height - padding
      );
    };

    const distanceToSegment = (point, start, end) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (dx === 0 && dy === 0) {
        const px = point.x - start.x;
        const py = point.y - start.y;
        return Math.sqrt(px * px + py * py);
      }

      const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
      const clampedT = Math.max(0, Math.min(1, t));
      const closestX = start.x + clampedT * dx;
      const closestY = start.y + clampedT * dy;
      const distX = point.x - closestX;
      const distY = point.y - closestY;
      return Math.sqrt(distX * distX + distY * distY);
    };

    const hasClearLineOfSight = (pairPositions, existingCapsules) => {
      const segments = [
        [pairPositions.hebrew, pairPositions.transliteration],
        [pairPositions.hebrew, pairPositions.meaning],
        [pairPositions.transliteration, pairPositions.meaning]
      ];

      return segments.every(([start, end]) =>
        existingCapsules.every(cap => {
          const distance = distanceToSegment({ x: cap.x, y: cap.y }, start, end);
          return distance >= LINE_OF_SIGHT_BUFFER;
        })
      );
    };

    const resolveSpawnOverlaps = (capsulesToResolve) => {
      const minX = padding;
      const maxX = bounds.width - padding;
      const minY = padding;
      const maxY = bounds.height - padding;
      const maxIterations = 30;
      const pairGroups = new Map();

      capsulesToResolve.forEach(capsule => {
        if (!pairGroups.has(capsule.pairIndex)) {
          pairGroups.set(capsule.pairIndex, []);
        }
        pairGroups.get(capsule.pairIndex).push(capsule);
      });

      const clampCapsule = (capsule) => {
        capsule.x = Math.max(minX, Math.min(maxX, capsule.x));
        capsule.y = Math.max(minY, Math.min(maxY, capsule.y));
      };

      const applyPairOffset = (pairIndex, offsetX, offsetY) => {
        const group = pairGroups.get(pairIndex) || [];
        group.forEach(member => {
          member.x += offsetX;
          member.y += offsetY;
          clampCapsule(member);
        });
      };

      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        let moved = false;

        for (let i = 0; i < capsulesToResolve.length; i += 1) {
          for (let j = i + 1; j < capsulesToResolve.length; j += 1) {
            const first = capsulesToResolve[i];
            const second = capsulesToResolve[j];
            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (first.radius ?? CAPSULE_RADIUS) +
              (second.radius ?? CAPSULE_RADIUS) +
              CAPSULE_CLEARANCE_BUFFER;

            if (distance < minDistance) {
              const overlap = minDistance - distance;
              const angle = distance === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
              const offsetX = Math.cos(angle) * (overlap / 2);
              const offsetY = Math.sin(angle) * (overlap / 2);

              if (first.pairIndex === second.pairIndex) {
                first.x -= offsetX;
                first.y -= offsetY;
                second.x += offsetX;
                second.y += offsetY;
                clampCapsule(first);
                clampCapsule(second);
              } else {
                applyPairOffset(first.pairIndex, -offsetX, -offsetY);
                applyPairOffset(second.pairIndex, offsetX, offsetY);
              }
              moved = true;
            }
          }
        }

        if (!moved) {
          break;
        }
      }
    };

    // Create capsules in straight vertical columns by TYPE
    // (left: ALL Hebrew, middle: ALL Transliteration, right: ALL Meaning)
    const columnWidth = usableWidth / 3;
    const hebrewColumnX = padding + columnWidth / 2;
    const translitColumnX = bounds.width / 2; // Center column aligned with start button
    const meaningColumnX = padding + 2 * columnWidth + columnWidth / 2;

    // Calculate equidistant Y positions for grid formation with contextual centering
    const numPairs = uniquePairs.length;
    const gridYPositions = [];

    if (numPairs === 1) {
      // Single pair - center it vertically in the available space (excluding bottom button area)
      const availableCenter = padding + (usableHeight / 2);
      gridYPositions.push(availableCenter);
    } else {
      // Multiple pairs - calculate centered grid based on number of capsules
      const targetSpacing = 100; // Target spacing between capsule centers
      const minEdgePadding = 60; // Minimum padding from edges
      const totalGridHeight = targetSpacing * (numPairs - 1);
      const maxAvailableHeight = usableHeight - 2 * minEdgePadding;

      let actualGridHeight, topOffset;

      if (totalGridHeight <= maxAvailableHeight) {
        // Grid fits with target spacing - center it vertically
        actualGridHeight = totalGridHeight;
        const extraSpace = usableHeight - actualGridHeight;
        topOffset = padding + extraSpace / 2;
      } else {
        // Grid too large - compress to fit with minimum padding
        actualGridHeight = maxAvailableHeight;
        topOffset = padding + minEdgePadding;
      }

      const actualSpacing = actualGridHeight / (numPairs - 1);

      for (let i = 0; i < numPairs; i++) {
        const y = topOffset + (actualSpacing * i);
        gridYPositions.push(y);
      }
    }

    // Shuffle helper function (Fisher-Yates shuffle)
    const shuffle = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Create randomized orderings for each column
    const hebrewOrder = shuffle([...Array(numPairs).keys()]);
    const translitOrder = shuffle([...Array(numPairs).keys()]);
    const meaningOrder = shuffle([...Array(numPairs).keys()]);

    // Create ALL Hebrew capsules in left column (grid positions, randomized order)
    uniquePairs.forEach((pair, pairIndex) => {
      const radius = getCapsuleRadius(pair.hebrew, true);
      const positionIndex = hebrewOrder[pairIndex];
      const y = gridYPositions[positionIndex];
      const wanderDelay = 1200 + Math.random() * 1800;

      capsules.push({
        id: `hebrew-${pairIndex}`,
        type: 'hebrew',
        text: pair.hebrew,
        pairIndex: pairIndex,
        x: hebrewColumnX,
        y: y,
        radius: radius,
        vx: 0,
        vy: 0,
        targetVx: 0,
        targetVy: 0,
        nextWanderAt: Date.now() + wanderDelay,
        matched: false,
        shaking: false,
        visible: false
      });
    });

    // Create ALL Transliteration capsules in middle column (grid positions, randomized order)
    uniquePairs.forEach((pair, pairIndex) => {
      const radius = getCapsuleRadius(pair.transliteration || pair.hebrew, false);
      const positionIndex = translitOrder[pairIndex];
      const y = gridYPositions[positionIndex];
      const wanderDelay = 1200 + Math.random() * 1800;

      capsules.push({
        id: `transliteration-${pairIndex}`,
        type: 'transliteration',
        text: pair.transliteration || pair.hebrew,
        pairIndex: pairIndex,
        x: translitColumnX,
        y: y,
        radius: radius,
        vx: 0,
        vy: 0,
        targetVx: 0,
        targetVy: 0,
        nextWanderAt: Date.now() + wanderDelay,
        matched: false,
        shaking: false,
        visible: false
      });
    });

    // Create ALL Meaning capsules in right column (grid positions, randomized order)
    uniquePairs.forEach((pair, pairIndex) => {
      const radius = getCapsuleRadius(pair.meaning, false);
      const positionIndex = meaningOrder[pairIndex];
      const y = gridYPositions[positionIndex];
      const wanderDelay = 1200 + Math.random() * 1800;

      capsules.push({
        id: `meaning-${pairIndex}`,
        type: 'meaning',
        text: pair.meaning,
        pairIndex: pairIndex,
        x: meaningColumnX,
        y: y,
        radius: radius,
        vx: 0,
        vy: 0,
        targetVx: 0,
        targetVy: 0,
        nextWanderAt: Date.now() + wanderDelay,
        matched: false,
        shaking: false,
        visible: false
      });
    });

    // NOTE: resolveSpawnOverlaps is disabled because:
    // 1. It adds CAPSULE_CLEARANCE_BUFFER which we don't want for tight collisions
    // 2. It moves entire pairs together, breaking the column-by-type layout
    // 3. We already handle collision avoidance during initial placement with isTooClose()
    // resolveSpawnOverlaps(capsules);

    capsulesRef.current = capsules;

    // Show all hint lines initially (will be hidden when player first clicks a capsule)
    setShowLines(true);
    setCurrentHintPairIndex(-1); // -1 means show all lines
  }, [wordPairs, playAreaBounds]);

  // Staggered spawn: make each pair visible with 2s delay between pairs, starting 1s after mount
  useEffect(() => {
    const timeouts = [];
    const numPairs = wordPairs.length;

    // Schedule visibility for each pair
    for (let pairIndex = 0; pairIndex < numPairs; pairIndex++) {
      const delay = 1000 + (pairIndex * 1000); // 1s initial + 2s per pair
      const timeout = setTimeout(() => {
        capsulesRef.current.forEach(capsule => {
          if (capsule.pairIndex === pairIndex) {
            capsule.visible = true;
          }
        });
        // Force re-render so capsules appear at the same time as hint lines
        forceUpdate(n => n + 1);
      }, delay);
      timeouts.push(timeout);
    }

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [wordPairs]);

  // Ensure no duplicate meanings (add disambiguators if needed)
  function ensureUniquePairs(pairs) {
    const meaningCounts = {};
    pairs.forEach(p => {
      meaningCounts[p.meaning] = (meaningCounts[p.meaning] || 0) + 1;
    });

    const counters = {};
    return pairs.map(pair => {
      const meaning = pair.meaning;
      if (meaningCounts[meaning] > 1) {
        counters[meaning] = (counters[meaning] || 0) + 1;
        return {
          ...pair,
          meaning: `${meaning} (${counters[meaning]})`
        };
      }
      return pair;
    });
  }

  // Animation loop - keep capsules moving even during drag
  useEffect(() => {
    if (gameState !== 'playing' || !gameStarted) return;

    function animate() {
      const capsules = capsulesRef.current;
      const bounds = playAreaBounds;

      const now = Date.now();
      capsules.forEach((capsule, index) => {
        // Skip matched or invisible capsules
        if (capsule.matched || !capsule.visible) return;

        // Clean up shake animation
        if (capsule.shakeUntil && now >= capsule.shakeUntil) {
          capsule.shaking = false;
          capsule.shakeUntil = null;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, gameStarted, playAreaBounds]);

  // Pointer event handlers - all capsule types are draggable
  const handlePointerDown = useCallback((e, capsule, index) => {
    if (capsule.matched || !capsule.visible) return; // Prevent dragging if invisible or if already matched

    // Auto-start game on first capsule interaction
    if (!gameStarted) {
      setGameStarted(true);
      setShowLines(false);
      startTimeRef.current = Date.now();
    }

    e.preventDefault();
    const rect = playAreaRef.current.getBoundingClientRect();
    dragStateRef.current = {
      isDragging: true,
      capsuleIndex: index,
      capsuleType: capsule.type, // Track which type we're dragging
      offsetX: e.clientX - rect.left - capsule.x,
      offsetY: e.clientY - rect.top - capsule.y
    };

    e.target.setPointerCapture(e.pointerId);
  }, [gameStarted]);

  const handlePointerMove = useCallback((e) => {
    if (!dragStateRef.current.isDragging) return;

    const rect = playAreaRef.current.getBoundingClientRect();
    const index = dragStateRef.current.capsuleIndex;
    const capsule = capsulesRef.current[index];

    capsule.x = e.clientX - rect.left - dragStateRef.current.offsetX;
    capsule.y = e.clientY - rect.top - dragStateRef.current.offsetY;
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!dragStateRef.current.isDragging) return;

    const index = dragStateRef.current.capsuleIndex;
    const draggedCapsule = capsulesRef.current[index];

    const candidates = capsulesRef.current
      .map((capsule, capsuleIndex) => ({ capsule, capsuleIndex }))
      .filter(({ capsule, capsuleIndex }) => capsuleIndex !== index && !capsule.matched && capsule.visible)
      .map(({ capsule }) => {
        const dx = draggedCapsule.x - capsule.x;
        const dy = draggedCapsule.y - capsule.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return { capsule, distance };
      })
      .filter(({ distance }) => distance < CAPSULE_RADIUS * 2)
      .sort((a, b) => a.distance - b.distance);

    const target = candidates[0]?.capsule;

    if (target) {
      if (draggedCapsule.pairIndex === target.pairIndex) {
        const remainingForPair = capsulesRef.current.filter(
          c => c.pairIndex === draggedCapsule.pairIndex && !c.matched
        );
        const removeTarget = remainingForPair.length <= 2;

        draggedCapsule.popping = true;
        if (removeTarget) {
          target.popping = true;
        }

        setTimeout(() => {
          draggedCapsule.matched = true;
          if (removeTarget) {
            target.matched = true;
          }

          // Check for orphaned capsules (single capsule left in a triplet)
          const pairGroups = new Map();
          capsulesRef.current.forEach(c => {
            if (!c.matched) {
              if (!pairGroups.has(c.pairIndex)) {
                pairGroups.set(c.pairIndex, []);
              }
              pairGroups.get(c.pairIndex).push(c);
            }
          });

          // Auto-remove any orphaned capsules (only 1 remaining in group)
          const orphanedCapsules = [];
          pairGroups.forEach((group, pairIndex) => {
            if (group.length === 1) {
              const orphan = group[0];
              orphan.matched = true;
              orphan.popping = true;
              orphanedCapsules.push(orphan);
            }
          });

          // Add orphaned capsules to ghost pairs
          if (orphanedCapsules.length > 0) {
            orphanedCapsules.forEach(orphan => {
              setGhostPairs(prev => [...prev, {
                items: [{ text: orphan.text, type: orphan.type }],
                x: orphan.x,
                y: orphan.y,
                startY: orphan.y,
                timestamp: Date.now()
              }]);
            });
          }

          const allMatched = capsulesRef.current.every(c => c.matched);
          if (allMatched) {
            const time = Date.now() - startTimeRef.current;
            setCompletionTime(time);
            setGameState('completed');
          }
        }, 400);

        const removedCapsules = [
          { text: draggedCapsule.text, type: draggedCapsule.type }
        ];
        if (removeTarget) {
          removedCapsules.push({ text: target.text, type: target.type });
        }

        setGhostPairs(prev => [...prev, {
          items: removedCapsules,
          x: removeTarget ? (draggedCapsule.x + target.x) / 2 : draggedCapsule.x,
          y: removeTarget ? (draggedCapsule.y + target.y) / 2 : draggedCapsule.y,
          startY: removeTarget ? (draggedCapsule.y + target.y) / 2 : draggedCapsule.y,
          timestamp: Date.now()
        }]);
      } else {
        draggedCapsule.shaking = true;
        draggedCapsule.shakeUntil = Date.now() + 500;
        setMismatchCount(prev => prev + 1);
      }
    }

    dragStateRef.current.isDragging = false;
  }, []);

  // Draw canvas overlay for lines
  useEffect(() => {
    if (!canvasRef.current || !showLines) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bounds = playAreaBounds;

    canvas.width = bounds.width;
    canvas.height = bounds.height;

    // Colors for hint lines - highly distinguishable colors with better contrast
    const hintColors = [
      'rgba(239, 68, 68, 0.7)',     // Bright Red
      'rgba(22, 163, 74, 0.7)',     // Deep Green
      'rgba(255, 159, 28, 0.7)',    // Bright Orange
      'rgba(59, 130, 246, 0.7)',    // Bright Blue
      'rgba(236, 72, 153, 0.7)',    // Hot Pink
      'rgba(168, 85, 247, 0.7)',    // Purple
      'rgba(14, 165, 233, 0.7)',    // Sky Blue
      'rgba(234, 179, 8, 0.7)',     // Gold/Yellow
      'rgba(20, 184, 166, 0.7)',    // Teal
      'rgba(248, 113, 113, 0.7)',   // Light Red
    ];

    // Helper to calculate edge points for line connections
    // Lines connect at far end points: right edge of left capsule, left edge of right capsule
    const getEdgePoints = (capsuleA, capsuleB) => {
      const radiusA = capsuleA.radius ?? CAPSULE_RADIUS;
      const radiusB = capsuleB.radius ?? CAPSULE_RADIUS;

      // Determine which capsule is on the left based on x position
      const leftCapsule = capsuleA.x < capsuleB.x ? capsuleA : capsuleB;
      const rightCapsule = capsuleA.x < capsuleB.x ? capsuleB : capsuleA;
      const leftRadius = leftCapsule.radius ?? CAPSULE_RADIUS;
      const rightRadius = rightCapsule.radius ?? CAPSULE_RADIUS;

      // Start at right edge of left capsule
      const startX = leftCapsule.x + leftRadius;
      const startY = leftCapsule.y;

      // End at left edge of right capsule
      const endX = rightCapsule.x - rightRadius;
      const endY = rightCapsule.y;

      return { startX, startY, endX, endY };
    };

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!showLines) return;

      const capsules = capsulesRef.current;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (currentHintPairIndex === -1) {
        // Show all hint lines initially
        const pairs = new Map();
        capsules.forEach(c => {
          if (!c.matched && c.visible) {
            if (!pairs.has(c.pairIndex)) {
              pairs.set(c.pairIndex, []);
            }
            pairs.get(c.pairIndex).push(c);
          }
        });

        pairs.forEach((pairCapsules, pairIndex) => {
          // Use different color for each pair
          ctx.strokeStyle = hintColors[pairIndex % hintColors.length];

          // Draw lines connecting all capsules in this pair (except Hebrew-to-Meaning)
          for (let i = 0; i < pairCapsules.length; i += 1) {
            for (let j = i + 1; j < pairCapsules.length; j += 1) {
              // Skip Hebrew-to-Meaning connection
              const isHebrewToMeaning =
                (pairCapsules[i].type === 'hebrew' && pairCapsules[j].type === 'meaning') ||
                (pairCapsules[i].type === 'meaning' && pairCapsules[j].type === 'hebrew');

              if (!isHebrewToMeaning) {
                const { startX, startY, endX, endY } = getEdgePoints(pairCapsules[i], pairCapsules[j]);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
              }
            }
          }
        });
      } else {
        // Show lines for the current hint pair only (succession mode)
        const pairCapsules = capsules.filter(
          c => !c.matched && c.visible && c.pairIndex === currentHintPairIndex
        );

        // Use different color for each pair
        ctx.strokeStyle = hintColors[currentHintPairIndex % hintColors.length];

        // Draw lines connecting all capsules in this pair (except Hebrew-to-Meaning)
        for (let i = 0; i < pairCapsules.length; i += 1) {
          for (let j = i + 1; j < pairCapsules.length; j += 1) {
            // Skip Hebrew-to-Meaning connection
            const isHebrewToMeaning =
              (pairCapsules[i].type === 'hebrew' && pairCapsules[j].type === 'meaning') ||
              (pairCapsules[i].type === 'meaning' && pairCapsules[j].type === 'hebrew');

            if (!isHebrewToMeaning) {
              const { startX, startY, endX, endY } = getEdgePoints(pairCapsules[i], pairCapsules[j]);
              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, endY);
              ctx.stroke();
            }
          }
        }
      }

      requestAnimationFrame(draw);
    }

    draw();
  }, [showLines, currentHintPairIndex, playAreaBounds]);

  // Clean up ghosts after fade
  useEffect(() => {
    const interval = setInterval(() => {
      setGhostPairs(prev =>
        prev.filter(ghost => Date.now() - ghost.timestamp < 2000)
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  if (gameState === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">✓</div>
          <h2 className="text-2xl font-bold text-white">Completed!</h2>
          <div className="text-slate-300 space-y-2">
            <p>Time: {(completionTime / 1000).toFixed(1)}s</p>
            <p>Mismatches: {mismatchCount}</p>
          </div>

          {/* Recap of pairs */}
          <div className="mt-6 space-y-2 text-sm">
            <p className="text-slate-400">Words learned:</p>
            {wordPairs.map((pair, i) => (
              <div key={i} className="flex gap-3 justify-center items-center">
                <span className="hebrew-font text-white" dir="rtl">{pair.hebrew}</span>
                <span className="text-slate-400 text-xs">({pair.transliteration || pair.hebrew})</span>
                <span className="text-slate-400">→</span>
                <span className="text-white">{pair.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onComplete({ completionTime, mismatchCount })}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Canvas for lines */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: showLines ? 1 : 0 }}
      />

      {/* Play area */}
      <div
        ref={playAreaRef}
        className="absolute inset-0"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Ghost pairs (afterimages) - float upward with colored text */}
        {ghostPairs.map((ghost, i) => {
          const age = Date.now() - ghost.timestamp;
          const duration = 2500; // Float for 2.5 seconds
          const progress = Math.min(age / duration, 1);

          // Float upward 150px over the duration
          const floatDistance = 150;
          const currentY = ghost.startY - (floatDistance * progress);

          // Fade out gradually
          const opacity = 1 - progress;

          if (progress >= 1) return null; // Don't render if done

          return (
            <div
              key={`ghost-${i}`}
              className="absolute pointer-events-none flex flex-col items-center gap-1"
              style={{
                left: ghost.x,
                top: currentY,
                transform: 'translate(-50%, -50%)',
                opacity
              }}
            >
              {ghost.items.map((item, itemIndex) => {
                const isHebrew = item.type === 'hebrew';
                return (
                  <span
                    key={`${item.text}-${itemIndex}`}
                    className={`font-semibold drop-shadow-lg ${
                      isHebrew ? 'hebrew-font text-emerald-200' : 'text-slate-200'
                    }`}
                    dir={isHebrew ? 'rtl' : 'ltr'}
                  >
                    {item.text}
                  </span>
                );
              })}
            </div>
          );
        })}

        {/* Capsules */}
        {capsulesRef.current.map((capsule, index) => {
          if (capsule.matched || !capsule.visible) return null;

          const isHebrew = capsule.type === 'hebrew';
          const isTransliteration = capsule.type === 'transliteration';
          const isDragging = dragStateRef.current.isDragging && dragStateRef.current.capsuleIndex === index;
          const isPopping = capsule.popping;

          return (
            <div
              key={capsule.id}
              className={`absolute select-none transition-all cursor-grab active:cursor-grabbing ${
                capsule.shaking ? 'animate-shake' : ''
              } ${
                isPopping ? 'animate-pop' : ''
              }`}
              style={{
                left: capsule.x,
                top: capsule.y,
                transform: 'translate(-50%, -50%)',
                touchAction: 'none'
              }}
              onPointerDown={(e) => handlePointerDown(e, capsule, index)}
            >
              <div
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap shadow-lg transition-all ${
                  isHebrew
                    ? 'bg-blue-600 text-white'
                    : isTransliteration
                      ? 'bg-amber-500 text-white'
                      : 'bg-purple-600 text-white'
                } ${
                  isDragging ? 'scale-110 shadow-2xl' : ''
                } ${
                  capsule.shaking ? 'ring-2 ring-red-500' : ''
                }`}
                dir={isHebrew ? 'rtl' : 'ltr'}
              >
                {isHebrew && <span className="hebrew-font">{capsule.text}</span>}
                {!isHebrew && capsule.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint button (only shown after game has started) */}
      {gameStarted && !showLines && (
        <button
          onClick={() => {
            // Restart hint succession
            setCurrentHintPairIndex(0);
            setShowLines(true);

            const totalPairs = wordPairs.length;
            const hintInterval = setInterval(() => {
              setCurrentHintPairIndex(prev => {
                const nextIndex = prev + 1;
                if (nextIndex >= totalPairs) {
                  setShowLines(false);
                  clearInterval(hintInterval);
                  return prev;
                }
                return nextIndex;
              });
            }, 800); // 0.8 seconds per pair
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
        >
          Show Hint
        </button>
      )}

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%) translateX(0); }
          25% { transform: translate(-50%, -50%) translateX(-10px); }
          75% { transform: translate(-50%, -50%) translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }

        @keyframes pop {
          0% { transform: translate(-50%, -50%) scale(1); }
          25% { transform: translate(-50%, -50%) scale(1.2); }
          50% { transform: translate(-50%, -50%) scale(0.9); }
          75% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        .animate-pop {
          animation: pop 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
