import React from 'react';
import { ArrowLeft, Brain, Grid3X3, Lock, ShoppingCart, Users, Route, Blocks, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SavedGameState } from '@/App';

interface GameSelectScreenProps {
  onBack: () => void;
  onSelectMemoryGame: () => void;
  onSelectDualNBack: () => void;
  savedGameState: SavedGameState | null;
}

const comingSoonGames = [
  { name: 'Pattern Recall', icon: Blocks },
  { name: 'Infinite Grid Match', icon: Grid3X3 },
  { name: 'Head Count', icon: Users },
  { name: 'Chasing Trails', icon: Route },
  { name: 'Word Association Matrix', icon: Network },
  { name: 'The Grocery Run', icon: ShoppingCart },
];

export const GameSelectScreen: React.FC<GameSelectScreenProps> = ({
  onBack,
  onSelectMemoryGame,
  onSelectDualNBack,
  savedGameState,
}) => {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? 'mobile-game-container bg-gradient-to-br from-blue-50 to-indigo-50 p-4 overflow-y-auto' : 'game-container bg-gradient-to-br from-blue-50 to-indigo-50 p-4 overflow-y-auto'}>
      <div className="min-h-full flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <img
            src="/logo/memory-master-logo.png"
            alt="Memory Master"
            className="w-28 h-auto object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="text-center mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-game-primary mb-1">
            Choose your training mode
          </p>
          <h1 className="text-2xl font-bold text-foreground">Brain Games</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Pick a challenge for memory, attention, and fast pattern recognition.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onSelectMemoryGame}
            className="w-full text-left bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-white hover:border-game-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-game-primary/10 flex items-center justify-center shrink-0">
                <Grid3X3 className="w-5 h-5 text-game-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-foreground">Memory Master</h2>
                  <span className="text-[10px] font-bold uppercase text-green-700 bg-green-100 px-2 py-1 rounded-full">
                    Available
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Memorize Tetris-like shapes, recreate them on the grid, and climb the leaderboard.
                </p>
                {savedGameState && (
                  <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-3">
                    Resume: Level {savedGameState.level} · {savedGameState.score.toLocaleString()} pts · {savedGameState.lives} {savedGameState.lives === 1 ? 'life' : 'lives'}
                  </p>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={onSelectDualNBack}
            className="w-full text-left bg-slate-950 text-white rounded-2xl shadow-lg p-4 border border-cyan-300/30 hover:border-cyan-300/70 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-300/10 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-cyan-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold">Letter Grid</h2>
                  <span className="text-[10px] font-bold uppercase text-cyan-950 bg-cyan-300 px-2 py-1 rounded-full">
                    New
                  </span>
                </div>
                <p className="text-xs text-cyan-50/70 mt-1">
                  Learn fixed letter-to-grid pairs, then recall each letter's box under pressure.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Coming Soon</h2>
          <div className="grid grid-cols-2 gap-3">
            {comingSoonGames.map(({ name, icon: Icon }) => (
              <div key={name} className="bg-white/75 rounded-xl border border-white p-3 min-h-[98px] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4 text-game-secondary" />
                  </div>
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-tight">{name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Coming soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
