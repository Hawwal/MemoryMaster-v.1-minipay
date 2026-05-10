import React from 'react';
import { Heart, Trophy, Star, Menu, Pause, Play, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GameHeaderProps {
  level: number;
  score: number;
  lives: number;
  isPlaying: boolean;
  isPaused: boolean;
  onMenuClick: () => void;
  onPauseClick?: () => void;
  onHomeClick: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  level,
  score,
  lives,
  isPlaying,
  isPaused,
  onMenuClick,
  onPauseClick,
  onHomeClick,
}) => {
  return (
    <div className="bg-card rounded-lg px-3 py-2 shadow-sm border mb-4">
      <div className="flex items-center justify-between gap-1">

        {/* Home button — compact, inside the bar */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onHomeClick}
          className="w-7 h-7 shrink-0"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </Button>

        {/* Level + Score */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-game-warning shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">Lv {level}</span>
          </div>

          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-game-primary shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">{score} pts</span>
          </div>
        </div>

        {/* Lives + Pause + Menu */}
        {isPlaying && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }, (_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 ${
                    i < lives ? 'text-game-error fill-game-error' : 'text-muted-foreground'
                  }`}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onPauseClick || (() => {})}
              className="w-7 h-7"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="w-7 h-7"
            >
              <Menu className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
