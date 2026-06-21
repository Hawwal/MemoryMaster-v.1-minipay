import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  HelpCircle,
  Home,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trophy,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { WalletService } from '@/lib/walletService';

type ScreenState = 'start' | 'countdown' | 'playing' | 'summary';
type GamePhase = 'learning' | 'challenge';
type FeedbackTone = 'correct' | 'wrong' | '';

type LetterMapping = {
  letter: string;
  position: number;
};

type ClickedCell = {
  index: number;
  correct: boolean;
};

type LetterGridLeaderboardEntry = {
  id: string;
  walletAddress: string | null;
  username: string;
  userHandle: string;
  score: number;
  highestN: number;
  accuracy: number;
  correctResponses: number;
  challengeRounds: number;
  durationSeconds: number;
  bestStreak: number;
  signature?: string | null;
  updatedAt: string;
};

type ContinueSnapshot = {
  mappings: LetterMapping[];
  nLevel: number;
  highestN: number;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  streak: number;
  bestStreak: number;
  challengeAttempts: number;
  successfulAttempts: number;
  challengeInStage: number;
  challengeGoal: number;
  roundIndex: number;
  playStartedAt: number | null;
  playDurationSeconds: number;
  walletAddress: string | null;
};

interface DualNBackGameProps {
  onGoHome: () => void;
  onPaymentRequest: () => void;
  continueToken: number;
}

const MAX_STRIKES = 10;
const LEARNING_REPEAT_COUNT = 1;
const LEARNING_MS = 1250;
const LEARNING_GAP_MS = 240;
const CHALLENGE_MS = 3000;
const FEEDBACK_MS = 650;
const LETTER_GRID_LEADERBOARD_KEY = 'memoryMaster.letterGrid.leaderboard';
const LETTER_GRID_PLAYER_ID_KEY = 'memoryMaster.letterGrid.playerId';
const LETTER_GRID_CONTINUE_KEY = 'memoryMaster.letterGrid.continueSnapshot';
const LETTER_LABELS = Array.from({ length: 40 }, (_, index) => {
  if (index < 26) return String.fromCharCode(65 + index);
  return `${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) + 1}`;
});

const tips = [
  {
    title: 'Learn the pairs',
    body: 'First, the game shows each letter with its grid box. Example: A lights box 1, B lights box 5.',
  },
  {
    title: 'Remember the box',
    body: 'During the challenge, only the letter appears. Tap the box that belongs to that letter.',
  },
  {
    title: 'One stage, fixed answers',
    body: 'A letter never moves during the same level. If A is box 1, A stays box 1 until the next level.',
  },
  {
    title: 'Avoid strikes',
    body: 'Wrong taps and 3-second timeouts add strikes. The main game ends at 10 total strikes.',
  },
];

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const getLetterCount = (level: number) => Math.min(level + 1, LETTER_LABELS.length);
const getChallengeGoal = (level: number) => Math.max(8, getLetterCount(level) * 3);

const buildStageMappings = (level: number): LetterMapping[] => {
  const letterCount = getLetterCount(level);
  const uniquePositions = shuffle(Array.from({ length: 9 }, (_, index) => index));

  return Array.from({ length: letterCount }, (_, index) => ({
    letter: LETTER_LABELS[index],
    position: index < 9 ? uniquePositions[index] : randomInt(0, 8),
  }));
};

const getPlayerId = () => {
  const existing = localStorage.getItem(LETTER_GRID_PLAYER_ID_KEY);
  if (existing) return existing;
  const created = `letter_grid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(LETTER_GRID_PLAYER_ID_KEY, created);
  return created;
};

const sortLeaderboard = (entries: LetterGridLeaderboardEntry[]) => {
  return [...entries].sort((a, b) =>
    b.highestN - a.highestN ||
    b.score - a.score ||
    b.accuracy - a.accuracy ||
    a.durationSeconds - b.durationSeconds
  );
};

const getLeaderboard = () => {
  try {
    return sortLeaderboard(JSON.parse(localStorage.getItem(LETTER_GRID_LEADERBOARD_KEY) || '[]'));
  } catch {
    return [];
  }
};

const shouldReplaceEntry = (next: LetterGridLeaderboardEntry, existing: LetterGridLeaderboardEntry | null) => {
  if (!existing) return true;
  if (next.highestN !== existing.highestN) return next.highestN > existing.highestN;
  if (next.score !== existing.score) return next.score > existing.score;
  if (next.accuracy !== existing.accuracy) return next.accuracy > existing.accuracy;
  return next.durationSeconds < existing.durationSeconds;
};

const saveLeaderboardEntry = (entry: LetterGridLeaderboardEntry) => {
  const entries = getLeaderboard();
  const existingIndex = entries.findIndex(item => item.id === entry.id);
  const existing = existingIndex >= 0 ? entries[existingIndex] : null;

  if (!shouldReplaceEntry(entry, existing)) return entries;

  const next = existingIndex >= 0
    ? entries.map(item => item.id === entry.id ? entry : item)
    : [...entries, entry];
  const sorted = sortLeaderboard(next).slice(0, 50);
  localStorage.setItem(LETTER_GRID_LEADERBOARD_KEY, JSON.stringify(sorted));
  return sorted;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const shortAddress = (address: string | null) => {
  if (!address) return 'No wallet';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const DualNBackGame: React.FC<DualNBackGameProps> = ({ onGoHome, onPaymentRequest, continueToken }) => {
  const isMobile = useIsMobile();
  const learningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerIdRef = useRef(getPlayerId());
  const mappingsRef = useRef<LetterMapping[]>([]);
  const currentMappingRef = useRef<LetterMapping | null>(null);
  const phaseRef = useRef<GamePhase>('learning');
  const nLevelRef = useRef(1);
  const highestNRef = useRef(1);
  const scoreRef = useRef(0);
  const correctAnswersRef = useRef(0);
  const challengeAttemptsRef = useRef(0);
  const successfulAttemptsRef = useRef(0);
  const strikesRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const challengeInStageRef = useRef(0);
  const challengeGoalRef = useRef(getChallengeGoal(1));
  const roundIndexRef = useRef(0);
  const isTrialRef = useRef(false);
  const pausedRef = useRef(false);
  const roundOpenRef = useRef(false);
  const answeredRef = useRef(false);
  const isEndedRef = useRef(false);
  const playStartedAtRef = useRef<number | null>(null);
  const walletAddressRef = useRef<string | null>(null);
  const startStageRef = useRef<((level: number) => void) | null>(null);
  const walletServiceRef = useRef<WalletService | null>(null);
  const hasRecordedSessionRef = useRef(false);
  const handledContinueTokenRef = useRef(0);

  const [screen, setScreen] = useState<ScreenState>('start');
  const [phase, setPhase] = useState<GamePhase>('learning');
  const [mappings, setMappings] = useState<LetterMapping[]>([]);
  const [nLevel, setNLevel] = useState(1);
  const [highestN, setHighestN] = useState(1);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [challengeAttempts, setChallengeAttempts] = useState(0);
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [challengeInStage, setChallengeInStage] = useState(0);
  const [challengeGoal, setChallengeGoal] = useState(getChallengeGoal(1));
  const [roundIndex, setRoundIndex] = useState(0);
  const [learningStep, setLearningStep] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('-');
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [clickedCell, setClickedCell] = useState<ClickedCell | null>(null);
  const [feedback, setFeedback] = useState('Ready to learn');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('');
  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isTrialMode, setIsTrialMode] = useState(false);
  const [roundHint, setRoundHint] = useState('Practice shows hints and never counts strikes.');
  const [playDurationSeconds, setPlayDurationSeconds] = useState(0);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LetterGridLeaderboardEntry[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState<'idle' | 'connecting' | 'signing' | 'saved' | 'error'>('idle');
  const [recordMessage, setRecordMessage] = useState('');

  const accuracy = challengeAttempts === 0 ? 100 : Math.round((successfulAttempts / challengeAttempts) * 100);
  const currentRank = leaderboardEntries.findIndex(entry => entry.id === playerIdRef.current) + 1;
  const personalBest = leaderboardEntries.find(entry => entry.id === playerIdRef.current);
  const learningTotal = mappings.length * LEARNING_REPEAT_COUNT;

  const stats = useMemo(() => [
    { label: isTrialMode ? 'Mode' : 'Level', value: isTrialMode ? 'Practice' : `${nLevel}-Back` },
    { label: 'Score', value: score.toLocaleString() },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Strikes', value: isTrialMode ? '-' : `${strikes}/${MAX_STRIKES}` },
    { label: 'Progress', value: phase === 'learning' ? `${Math.min(learningStep + 1, learningTotal)}/${learningTotal}` : `${challengeInStage}/${challengeGoal}` },
  ], [accuracy, challengeGoal, challengeInStage, isTrialMode, learningStep, learningTotal, nLevel, phase, score, strikes]);

  const clearTimers = useCallback(() => {
    if (learningTimerRef.current) clearTimeout(learningTimerRef.current);
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    learningTimerRef.current = null;
    responseTimerRef.current = null;
    nextRoundTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const speakLetter = useCallback((letter: string) => {
    if (!soundOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(letter);
    utterance.rate = 0.95;
    utterance.pitch = 1.04;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }, [soundOn]);

  const buildLeaderboardEntry = useCallback((signature: string | null = null): LetterGridLeaderboardEntry => {
    const durationSeconds = playStartedAtRef.current
      ? Math.max(playDurationSeconds, Math.floor((Date.now() - playStartedAtRef.current) / 1000))
      : playDurationSeconds;
    const entryAccuracy = challengeAttemptsRef.current === 0
      ? 100
      : Math.round((successfulAttemptsRef.current / challengeAttemptsRef.current) * 100);

    return {
      id: playerIdRef.current,
      walletAddress: walletAddressRef.current,
      username: localStorage.getItem('userName') || 'Player',
      userHandle: localStorage.getItem('userHandle') || 'player',
      score: scoreRef.current,
      highestN: highestNRef.current,
      accuracy: entryAccuracy,
      correctResponses: correctAnswersRef.current,
      challengeRounds: challengeAttemptsRef.current,
      durationSeconds,
      bestStreak: bestStreakRef.current,
      signature,
      updatedAt: new Date().toISOString(),
    };
  }, [playDurationSeconds]);

  const updateLeaderboard = useCallback((signature: string | null = null) => {
    if (isTrialRef.current) return;
    const nextEntries = saveLeaderboardEntry(buildLeaderboardEntry(signature));
    setLeaderboardEntries(nextEntries);
  }, [buildLeaderboardEntry]);

  const syncWalletAddress = useCallback(async () => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) return null;
      const accounts: string[] = await eth.request({ method: 'eth_accounts' });
      const address = accounts[0] || null;
      walletAddressRef.current = address;
      setWalletAddress(address);
      return address;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    walletServiceRef.current = new WalletService({ onToast: () => {} });
    syncWalletAddress();

    if (!hasRecordedSessionRef.current) {
      hasRecordedSessionRef.current = true;
      setTimeout(() => {
        walletServiceRef.current?.recordPlay();
      }, 2000);
    }

    return () => {
      walletServiceRef.current?.destroy();
      walletServiceRef.current = null;
    };
  }, [syncWalletAddress]);

  const setPhaseState = (nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const setScoreState = (nextScore: number) => {
    scoreRef.current = nextScore;
    setScore(nextScore);
  };

  const setHighestState = (nextHighest: number) => {
    highestNRef.current = nextHighest;
    setHighestN(nextHighest);
  };

  const finishAttempt = useCallback((selectedIndex: number | null) => {
    if (!roundOpenRef.current || answeredRef.current || isEndedRef.current) return;
    const current = currentMappingRef.current;
    if (!current) return;

    answeredRef.current = true;
    roundOpenRef.current = false;
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    responseTimerRef.current = null;

    const correct = selectedIndex === current.position;
    setClickedCell({ index: selectedIndex ?? current.position, correct });
    setActiveCell(current.position);

    const nextAttempts = challengeAttemptsRef.current + 1;
    challengeAttemptsRef.current = nextAttempts;
    setChallengeAttempts(nextAttempts);
    challengeInStageRef.current += 1;
    setChallengeInStage(challengeInStageRef.current);

    if (correct) {
      const nextSuccessful = successfulAttemptsRef.current + 1;
      const nextCorrect = correctAnswersRef.current + 1;
      const nextStreak = streakRef.current + 1;
      const nextBestStreak = Math.max(bestStreakRef.current, nextStreak);
      const nextScore = scoreRef.current + (10 * nLevelRef.current) + Math.min(nextStreak, 10);

      successfulAttemptsRef.current = nextSuccessful;
      correctAnswersRef.current = nextCorrect;
      streakRef.current = nextStreak;
      bestStreakRef.current = nextBestStreak;
      setScoreState(nextScore);
      setSuccessfulAttempts(nextSuccessful);
      setCorrectAnswers(nextCorrect);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);
      setFeedback('Correct grid');
      setFeedbackTone('correct');
      updateLeaderboard();
    } else {
      streakRef.current = 0;
      setStreak(0);
      setFeedback(selectedIndex === null ? `Timeout. ${current.letter} was box ${current.position + 1}` : `Wrong grid. ${current.letter} is box ${current.position + 1}`);
      setFeedbackTone('wrong');

      if (!isTrialRef.current) {
        const nextStrikes = strikesRef.current + 1;
        strikesRef.current = nextStrikes;
        setStrikes(nextStrikes);
        setWrongAnswers(nextStrikes);
        if (nextStrikes >= MAX_STRIKES) {
          isEndedRef.current = true;
          updateLeaderboard();
          nextRoundTimerRef.current = setTimeout(() => {
            setScreen('summary');
            setAdOpen(Math.random() < 0.4);
          }, FEEDBACK_MS);
          return;
        }
      }
    }

    nextRoundTimerRef.current = setTimeout(() => {
      if (challengeInStageRef.current >= challengeGoalRef.current) {
        startStageRef.current?.(nLevelRef.current + 1);
      } else {
        beginChallengeRoundRef.current?.();
      }
    }, FEEDBACK_MS);
  }, [updateLeaderboard]);

  const beginChallengeRoundRef = useRef<(() => void) | null>(null);

  const beginChallengeRound = useCallback(() => {
    if (pausedRef.current || isEndedRef.current) return;
    clearTimers();

    const stageMappings = mappingsRef.current;
    if (stageMappings.length === 0) return;
    const nextMapping = stageMappings[randomInt(0, stageMappings.length - 1)];
    currentMappingRef.current = nextMapping;
    answeredRef.current = false;
    roundOpenRef.current = true;
    roundIndexRef.current += 1;

    setRoundIndex(roundIndexRef.current);
    setPhaseState('challenge');
    setCurrentLetter(nextMapping.letter);
    setActiveCell(null);
    setClickedCell(null);
    setFeedback('Tap the remembered grid box');
    setFeedbackTone('');
    setRoundHint(isTrialRef.current ? `${nextMapping.letter} belongs to box ${nextMapping.position + 1}. Tap that box.` : '');
    speakLetter(nextMapping.letter);

    responseTimerRef.current = setTimeout(() => finishAttempt(null), CHALLENGE_MS);
  }, [clearTimers, finishAttempt, speakLetter]);

  useEffect(() => {
    beginChallengeRoundRef.current = beginChallengeRound;
  }, [beginChallengeRound]);

  const playLearningStep = useCallback((step: number) => {
    if (pausedRef.current || isEndedRef.current) return;
    clearTimers();

    const stageMappings = mappingsRef.current;
    if (stageMappings.length === 0) return;
    const mapping = stageMappings[step % stageMappings.length];
    currentMappingRef.current = mapping;
    roundOpenRef.current = false;

    setPhaseState('learning');
    setLearningStep(step);
    setCurrentLetter(mapping.letter);
    setActiveCell(mapping.position);
    setClickedCell(null);
    setFeedback(`Learn: ${mapping.letter} is box ${mapping.position + 1}`);
    setFeedbackTone('');
    setRoundHint(isTrialRef.current ? `Watch only: ${mapping.letter} always maps to box ${mapping.position + 1} in this stage.` : '');
    speakLetter(mapping.letter);

    learningTimerRef.current = setTimeout(() => {
      setActiveCell(null);
      learningTimerRef.current = setTimeout(() => {
        const nextStep = step + 1;
        const totalSteps = stageMappings.length * LEARNING_REPEAT_COUNT;
        if (nextStep < totalSteps) {
          playLearningStep(nextStep);
        } else {
          setFeedback('Challenge begins');
          setFeedbackTone('correct');
          nextRoundTimerRef.current = setTimeout(beginChallengeRound, 500);
        }
      }, LEARNING_GAP_MS);
    }, LEARNING_MS);
  }, [beginChallengeRound, clearTimers, speakLetter]);

  const startStage = useCallback((level: number) => {
    clearTimers();
    const nextMappings = buildStageMappings(level);
    const nextGoal = getChallengeGoal(level);

    nLevelRef.current = level;
    challengeInStageRef.current = 0;
    challengeGoalRef.current = nextGoal;
    mappingsRef.current = nextMappings;
    currentMappingRef.current = null;
    roundOpenRef.current = false;
    answeredRef.current = false;

    setNLevel(level);
    setHighestState(Math.max(highestNRef.current, level));
    setMappings(nextMappings);
    setChallengeInStage(0);
    setChallengeGoal(nextGoal);
    setLearningStep(0);
    setClickedCell(null);
    setCurrentLetter('-');
    setFeedback(`${level}-Back learning phase`);
    setFeedbackTone('');
    updateLeaderboard();

    nextRoundTimerRef.current = setTimeout(() => playLearningStep(0), 450);
  }, [clearTimers, playLearningStep, updateLeaderboard]);

  useEffect(() => {
    startStageRef.current = startStage;
  }, [startStage]);

  const resetRun = useCallback((trialMode = false) => {
    clearTimers();
    mappingsRef.current = [];
    currentMappingRef.current = null;
    phaseRef.current = 'learning';
    nLevelRef.current = 1;
    highestNRef.current = 1;
    scoreRef.current = 0;
    correctAnswersRef.current = 0;
    challengeAttemptsRef.current = 0;
    successfulAttemptsRef.current = 0;
    strikesRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    challengeInStageRef.current = 0;
    challengeGoalRef.current = getChallengeGoal(1);
    roundIndexRef.current = 0;
    isTrialRef.current = trialMode;
    pausedRef.current = false;
    roundOpenRef.current = false;
    answeredRef.current = false;
    isEndedRef.current = false;
    playStartedAtRef.current = trialMode ? null : Date.now();

    setPhase('learning');
    setMappings([]);
    setNLevel(1);
    setHighestN(1);
    setScore(0);
    setCorrectAnswers(0);
    setWrongAnswers(0);
    setStrikes(0);
    setStreak(0);
    setBestStreak(0);
    setChallengeAttempts(0);
    setSuccessfulAttempts(0);
    setChallengeInStage(0);
    setChallengeGoal(getChallengeGoal(1));
    setRoundIndex(0);
    setLearningStep(0);
    setCurrentLetter('-');
    setActiveCell(null);
    setClickedCell(null);
    setFeedback('Ready to learn');
    setFeedbackTone('');
    setPaused(false);
    setIsTrialMode(trialMode);
    setRoundHint(trialMode ? 'Practice shows each answer as a hint. Strikes do not count.' : '');
    setPlayDurationSeconds(0);
    setAdOpen(false);
    setShowContinuePrompt(false);
    setRecordStatus('idle');
    setRecordMessage('');
  }, [clearTimers]);

  const runCountdown = useCallback((onDone: () => void) => {
    clearTimers();
    setScreen('countdown');
    setCountdown(3);
    let next = 3;
    const tick = () => {
      next -= 1;
      if (next <= 0) {
        countdownTimerRef.current = null;
        setScreen('playing');
        onDone();
        return;
      }
      setCountdown(next);
      countdownTimerRef.current = setTimeout(tick, 820);
    };
    countdownTimerRef.current = setTimeout(tick, 820);
  }, [clearTimers]);

  const startGame = useCallback((trialMode = false) => {
    resetRun(trialMode);
    runCountdown(() => startStage(1));
  }, [resetRun, runCountdown, startStage]);

  const startPractice = () => {
    setTipsOpen(false);
    setMenuOpen(false);
    startGame(true);
  };

  const handleGridCellClick = (index: number) => {
    if (screen !== 'playing' || isEndedRef.current) return;

    if (phaseRef.current === 'learning') {
      const current = currentMappingRef.current;
      if (!current) return;
      setClickedCell({ index, correct: index === current.position });
      return;
    }

    finishAttempt(index);
  };

  const togglePause = () => {
    if (screen !== 'playing') return;

    if (!paused) {
      clearTimers();
      roundOpenRef.current = false;
      pausedRef.current = true;
      setPaused(true);
      setFeedback('Paused');
      setFeedbackTone('');
      return;
    }

    pausedRef.current = false;
    setPaused(false);
    setFeedback('Resuming');
    setFeedbackTone('');
    if (phaseRef.current === 'learning') {
      playLearningStep(learningStep);
    } else {
      beginChallengeRound();
    }
  };

  const saveContinueSnapshot = () => {
    const snapshot: ContinueSnapshot = {
      mappings: mappingsRef.current,
      nLevel: nLevelRef.current,
      highestN: highestNRef.current,
      score: scoreRef.current,
      correctAnswers: correctAnswersRef.current,
      wrongAnswers,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
      challengeAttempts: challengeAttemptsRef.current,
      successfulAttempts: successfulAttemptsRef.current,
      challengeInStage: challengeInStageRef.current,
      challengeGoal: challengeGoalRef.current,
      roundIndex: roundIndexRef.current,
      playStartedAt: playStartedAtRef.current,
      playDurationSeconds,
      walletAddress: walletAddressRef.current,
    };
    localStorage.setItem(LETTER_GRID_CONTINUE_KEY, JSON.stringify(snapshot));
  };

  const handleContinue = () => {
    saveContinueSnapshot();
    setShowContinuePrompt(false);
    onPaymentRequest();
  };

  const resumeFromSnapshot = useCallback(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(LETTER_GRID_CONTINUE_KEY) || 'null') as ContinueSnapshot | null;
      if (!snapshot) {
        startGame(false);
        return;
      }

      clearTimers();
      mappingsRef.current = snapshot.mappings;
      nLevelRef.current = snapshot.nLevel;
      highestNRef.current = snapshot.highestN;
      scoreRef.current = snapshot.score;
      correctAnswersRef.current = snapshot.correctAnswers;
      challengeAttemptsRef.current = snapshot.challengeAttempts;
      successfulAttemptsRef.current = snapshot.successfulAttempts;
      strikesRef.current = 0;
      streakRef.current = snapshot.streak;
      bestStreakRef.current = snapshot.bestStreak;
      challengeInStageRef.current = snapshot.challengeInStage;
      challengeGoalRef.current = snapshot.challengeGoal;
      roundIndexRef.current = snapshot.roundIndex;
      phaseRef.current = 'challenge';
      isTrialRef.current = false;
      isEndedRef.current = false;
      pausedRef.current = false;
      walletAddressRef.current = snapshot.walletAddress;
      playStartedAtRef.current = snapshot.playStartedAt || Date.now();

      setMappings(snapshot.mappings);
      setNLevel(snapshot.nLevel);
      setHighestN(snapshot.highestN);
      setScore(snapshot.score);
      setCorrectAnswers(snapshot.correctAnswers);
      setWrongAnswers(snapshot.wrongAnswers);
      setStrikes(0);
      setStreak(snapshot.streak);
      setBestStreak(snapshot.bestStreak);
      setChallengeAttempts(snapshot.challengeAttempts);
      setSuccessfulAttempts(snapshot.successfulAttempts);
      setChallengeInStage(snapshot.challengeInStage);
      setChallengeGoal(snapshot.challengeGoal);
      setRoundIndex(snapshot.roundIndex);
      setPhase('challenge');
      setCurrentLetter('-');
      setActiveCell(null);
      setClickedCell(null);
      setFeedback('Continue unlocked. Strikes reset.');
      setFeedbackTone('correct');
      setIsTrialMode(false);
      setPlayDurationSeconds(snapshot.playDurationSeconds);
      setWalletAddress(snapshot.walletAddress);
      setAdOpen(false);
      setShowContinuePrompt(false);
      localStorage.removeItem(LETTER_GRID_CONTINUE_KEY);

      runCountdown(() => beginChallengeRound());
    } catch {
      startGame(false);
    }
  }, [beginChallengeRound, clearTimers, runCountdown, startGame]);

  const shareText = `I scored ${score.toLocaleString()} pts in Letter Grid and reached ${highestN}-Back with ${accuracy}% accuracy. Rank: ${currentRank > 0 ? `#${currentRank}` : 'unranked'}.`;
  const shareUrl = window.location.origin;
  const fullShareText = `${shareText}\n${shareUrl}`;

  const copyShareText = async () => {
    await navigator.clipboard.writeText(fullShareText);
    setRecordMessage('Share text copied.');
  };

  const shareOnTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank'
    );
  };

  const shareOnFarcaster = () => {
    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(fullShareText)}`, '_blank');
  };

  const shareOnInstagram = async () => {
    await copyShareText();
    window.open('https://www.instagram.com/', '_blank');
  };

  const shareOnSnapchat = () => {
    window.open(
      `https://www.snapchat.com/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      '_blank'
    );
  };

  const recordScoreOnChain = async () => {
    try {
      setRecordStatus('connecting');
      setRecordMessage('');
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No wallet detected. Use MiniPay or MetaMask.');
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      if (!address) throw new Error('Wallet connection failed.');
      walletAddressRef.current = address;
      setWalletAddress(address);

      setRecordStatus('signing');
      const message = [
        'Memory Master - Letter Grid Score',
        `Wallet: ${address}`,
        `Score: ${scoreRef.current}`,
        `Highest N-Level: ${highestNRef.current}`,
        `Accuracy: ${challengeAttemptsRef.current === 0 ? 100 : Math.round((successfulAttemptsRef.current / challengeAttemptsRef.current) * 100)}%`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');
      const signature: string = await eth.request({ method: 'personal_sign', params: [message, address] });
      updateLeaderboard(signature);
      setRecordStatus('saved');
      setRecordMessage('Score proof signed and saved with your leaderboard entry.');
    } catch (error: any) {
      setRecordStatus('error');
      setRecordMessage(error.message || 'Score recording failed.');
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (continueToken <= 0 || handledContinueTokenRef.current === continueToken) return;
    handledContinueTokenRef.current = continueToken;
    resumeFromSnapshot();
  }, [continueToken, resumeFromSnapshot]);

  useEffect(() => {
    setLeaderboardEntries(getLeaderboard());
    syncWalletAddress();
  }, [syncWalletAddress]);

  useEffect(() => {
    if (screen !== 'playing' || isTrialMode || !playStartedAtRef.current || paused) return;

    const timer = setInterval(() => {
      if (playStartedAtRef.current) {
        setPlayDurationSeconds(Math.floor((Date.now() - playStartedAtRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTrialMode, paused, screen]);

  return (
    <div className={`${isMobile ? 'mobile-game-container' : 'game-container'} dual-nback`}>
      <div className="dual-nback-scan" />

      <header className="dual-nback-header">
        <Button onClick={onGoHome} variant="ghost" size="icon" className="dual-nback-icon-button" aria-label="Home">
          <Home className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="dual-nback-kicker">Cyber Memory</p>
          <h1 className="dual-nback-title">Letter Grid</h1>
        </div>
        <Button onClick={() => setMenuOpen(true)} variant="ghost" size="icon" className="dual-nback-icon-button" aria-label="Menu">
          <Menu className="w-5 h-5" />
        </Button>
      </header>

      {screen === 'start' && (
        <main className="dual-nback-panel dual-nback-start">
          <div className="dual-nback-brain">
            <Brain className="w-12 h-12" />
          </div>
          <h2>Letter Grid</h2>
          <p>Learn fixed letter-to-grid pairs, then recall the correct box from memory before the timer runs out.</p>
          <div className="dual-nback-tip">
            <HelpCircle className="w-4 h-4" />
            <span>Learning rounds teach the pairs. Only challenge taps affect accuracy and strikes.</span>
          </div>
          <Button onClick={() => startGame(false)} className="dual-nback-dark-button">
            <Zap className="w-4 h-4 mr-2" />
            Start Game
          </Button>
          <Button onClick={() => setTipsOpen(true)} variant="outline" className="dual-nback-dark-button">
            <HelpCircle className="w-4 h-4 mr-2" />
            How to Play
          </Button>
          <Button onClick={() => setLeaderboardOpen(true)} variant="outline" className="dual-nback-dark-button">
            <Trophy className="w-4 h-4 mr-2" />
            Leaderboard
          </Button>
          <div className="dual-nback-personal-best">
            <span>Personal best: {personalBest ? `${personalBest.highestN}-Back - ${personalBest.score.toLocaleString()} pts` : 'No score yet'}</span>
            <span>Current rank: {currentRank > 0 ? `#${currentRank}` : '-'}</span>
          </div>
        </main>
      )}

      {screen === 'countdown' && (
        <main className="dual-nback-countdown" aria-live="assertive">
          <span>{countdown}</span>
        </main>
      )}

      {screen === 'playing' && (
        <main className="dual-nback-game">
          <section className="dual-nback-stats">
            {stats.map(stat => (
              <div key={stat.label} className="dual-nback-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </section>

          <div className="dual-nback-round-row">
            <span>{phase === 'learning' ? 'Learning' : 'Challenge'} {phase === 'learning' ? Math.min(learningStep + 1, learningTotal) : roundIndex}</span>
            <span className={feedbackTone}>{feedback}</span>
          </div>

          <div className="dual-nback-help-strip">
            {isTrialMode
              ? roundHint
              : phase === 'learning'
                ? 'Memorize each letter and lit box. The same letter keeps the same box for this N-level.'
                : 'Only the letter appears now. Tap its remembered grid box within 3 seconds.'}
          </div>

          <section className="dual-nback-grid" aria-label="3 by 3 Letter Grid">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`dual-nback-cell ${activeCell === index ? 'active' : ''} ${
                  clickedCell?.index === index ? (clickedCell.correct ? 'correct-click' : 'wrong-click') : ''
                }`}
                aria-label={`Grid position ${index + 1}`}
                role="button"
                tabIndex={0}
                onClick={() => handleGridCellClick(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleGridCellClick(index);
                  }
                }}
              />
            ))}
          </section>

          <div className="dual-nback-letter" aria-live="polite">{currentLetter}</div>

          {phase === 'learning' && mappings.length > 0 && (
            <div className="dual-nback-mapping-strip" aria-label="Current letter grid associations">
              {mappings.slice(0, 6).map(mapping => (
                <span key={mapping.letter}>{mapping.letter}:{mapping.position + 1}</span>
              ))}
              {mappings.length > 6 && <span>+{mappings.length - 6}</span>}
            </div>
          )}

          <section className="dual-nback-utility">
            <button type="button" onClick={togglePause}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={() => startGame(isTrialMode)}>
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
          </section>

          {!isTrialMode && (
            <div className="dual-nback-banner">
              <span>Advertisement</span>
              <strong>Memory Master Boost</strong>
              <small>Continue after 10 strikes for 0.1 USDT.</small>
            </div>
          )}
        </main>
      )}

      {screen === 'summary' && (
        <main className="dual-nback-panel dual-nback-summary">
          <p className="dual-nback-kicker">{isTrialMode ? 'Practice' : 'Game Over'}</p>
          <h2>{isTrialMode ? 'Practice Summary' : 'Letter Grid Summary'}</h2>
          <div className="dual-nback-summary-grid">
            <div><span>Score</span><strong>{score.toLocaleString()}</strong></div>
            <div><span>Highest N</span><strong>{highestN}-Back</strong></div>
            <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
            <div><span>Strikes</span><strong>{strikes}/{MAX_STRIKES}</strong></div>
          </div>
          <p className="dual-nback-summary-meta">
            Challenges: {correctAnswers} correct from {challengeAttempts} attempts. Duration: {formatDuration(playDurationSeconds)}.
          </p>
          <Button onClick={() => startGame(false)} className="dual-nback-dark-button">
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
          {!isTrialMode && (
            <Button onClick={() => setShowContinuePrompt(true)} className="dual-nback-dark-button">
              Continue Playing for 0.1 USDT
            </Button>
          )}
          <Button onClick={() => setShareOpen(true)} variant="outline" className="dual-nback-dark-button">
            <Share2 className="w-4 h-4 mr-2" />
            Share Score
          </Button>
          <Button onClick={onGoHome} variant="outline" className="dual-nback-dark-button">
            <Home className="w-4 h-4 mr-2" />
            Game Select
          </Button>
          <Button onClick={() => setLeaderboardOpen(true)} variant="outline" className="dual-nback-dark-button">
            <Trophy className="w-4 h-4 mr-2" />
            Leaderboard
          </Button>
        </main>
      )}

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Letter Grid Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)}><X className="w-4 h-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button onClick={() => { setMenuOpen(false); onGoHome(); }} variant="outline" className="w-full justify-start"><Home className="w-4 h-4 mr-2" />Game Select</Button>
            <Button onClick={() => { setMenuOpen(false); setTipsOpen(true); }} variant="outline" className="w-full justify-start"><HelpCircle className="w-4 h-4 mr-2" />Help Tips</Button>
            <Button onClick={() => { setMenuOpen(false); setLeaderboardOpen(true); }} variant="outline" className="w-full justify-start"><Trophy className="w-4 h-4 mr-2" />Leaderboard</Button>
            <Button onClick={startPractice} variant="outline" className="w-full justify-start"><Brain className="w-4 h-4 mr-2" />Start Practice</Button>
            <Button onClick={() => setSoundOn(prev => !prev)} variant="outline" className="w-full justify-start">
              {soundOn ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
              Sound: {soundOn ? 'On' : 'Off'}
            </Button>
            <Button onClick={() => { setMenuOpen(false); startGame(isTrialMode); }} variant="outline" className="w-full justify-start"><RotateCcw className="w-4 h-4 mr-2" />Restart</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tipsOpen} onOpenChange={setTipsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-cyan-500" />How to Play Letter Grid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="dual-nback-mini-diagram">
              <div>
                <span>Learn</span>
                <div className="dual-nback-mini-grid">{Array.from({ length: 9 }).map((_, index) => <i key={index} className={index === 0 ? 'active' : ''} />)}</div>
                <strong>A</strong>
              </div>
              <div className="dual-nback-mini-arrow">-&gt;</div>
              <div>
                <span>Recall</span>
                <div className="dual-nback-mini-grid">{Array.from({ length: 9 }).map((_, index) => <i key={index} className={index === 0 ? 'active' : ''} />)}</div>
                <strong>A</strong>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Example: if A is taught with box 1, then A always means box 1 until the next N-level starts.</p>
            {tips.map((tip, index) => (
              <div key={tip.title} className="flex gap-3 rounded-lg bg-muted p-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{tip.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{tip.body}</p>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-2 pt-2">
              <Button onClick={startPractice} className="dual-nback-dark-button">Start Practice</Button>
              <Button onClick={() => { setTipsOpen(false); startGame(false); }} variant="outline" className="dual-nback-dark-button">Start Main Game</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-cyan-500" />Letter Grid Leaderboard</DialogTitle></DialogHeader>
          <div className="dual-nback-leaderboard-summary">
            <div><span>Personal Best</span><strong>{personalBest ? `${personalBest.score.toLocaleString()} pts` : 'No score yet'}</strong></div>
            <div><span>Current Rank</span><strong>{currentRank > 0 ? `#${currentRank}` : '-'}</strong></div>
          </div>
          <div className="dual-nback-leaderboard-list">
            {leaderboardEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No Letter Grid scores yet.</p>
            ) : (
              leaderboardEntries.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className={entry.id === playerIdRef.current ? 'current-player' : ''}>
                  <strong>#{index + 1}</strong>
                  <section>
                    <h3>{entry.username}</h3>
                    <p>{entry.highestN}-Back - {entry.score.toLocaleString()} pts - {entry.accuracy}% accuracy</p>
                    <p>{entry.correctResponses}/{entry.challengeRounds} correct - {formatDuration(entry.durationSeconds)} - {shortAddress(entry.walletAddress)}</p>
                  </section>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Share Score</DialogTitle></DialogHeader>
          <div className="dual-nback-share-card">
            <span>Letter Grid</span>
            <strong>{score.toLocaleString()}</strong>
            <p>{highestN}-Back - {accuracy}% accuracy - Rank {currentRank > 0 ? `#${currentRank}` : '-'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={shareOnTwitter} className="dual-nback-dark-button">Twitter / X</Button>
            <Button onClick={shareOnFarcaster} className="dual-nback-dark-button">Farcaster</Button>
            <Button onClick={shareOnInstagram} className="dual-nback-dark-button">Instagram</Button>
            <Button onClick={shareOnSnapchat} className="dual-nback-dark-button">Snapchat</Button>
          </div>
          <Button onClick={copyShareText} variant="outline" className="w-full">Copy Share Text</Button>
          <Button onClick={recordScoreOnChain} className="w-full dual-nback-dark-button">
            <ShieldCheck className="w-4 h-4 mr-2" />
            On-chain
          </Button>
          {recordMessage && (
            <p className={`text-xs text-center ${recordStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>
              {recordMessage}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adOpen} onOpenChange={setAdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Sponsored Boost</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Reset your strikes and keep your Letter Grid run alive.</p>
          <Button onClick={() => { setAdOpen(false); setShowContinuePrompt(true); }} className="dual-nback-dark-button">Continue for 0.1 USDT</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showContinuePrompt} onOpenChange={setShowContinuePrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Continue Playing?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pay 0.1 USDT to reset strikes to 0 while keeping your score, accuracy, current N-level, and leaderboard eligibility.</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="w-4 h-4" />{walletAddress ? `${shortAddress(walletAddress)} connected` : 'Wallet payment required'}</div>
          <div className="flex gap-3">
            <Button onClick={() => setShowContinuePrompt(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleContinue} className="flex-1 dual-nback-dark-button">Pay & Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
