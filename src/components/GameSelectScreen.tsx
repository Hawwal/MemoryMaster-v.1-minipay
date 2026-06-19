import React, { useEffect, useState } from 'react';
import { ChevronLeft, Lock, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SavedGameState } from '@/App';

interface GameSelectScreenProps {
  onBack: () => void;
  onSelectMemoryGame: () => void;
  onSelectDualNBack: () => void;
  onOpenSettings: () => void;
  onNotifyRequest: () => void;
  initialTab: 'available' | 'coming';
  savedGameState: SavedGameState | null;
}

type GameMode = {
  id: 'memory-master' | 'letter-grid';
  name: string;
  description: string;
  status: 'available' | 'new';
  color: string;
  lightBg: string;
  icon: string;
  onSelect: () => void;
};

const comingSoon = [
  { name: 'Pattern Recall', icon: '▦', color: '#3BB589' },
  { name: 'Infinite Grid Match', icon: '∞', color: '#F5C842' },
  { name: 'Head Count', icon: '123', color: '#F06B3F' },
  { name: 'Chasing Trails', icon: '↝', color: '#7C3AED' },
  { name: 'Word Association Matrix', icon: 'Aa', color: '#5B9BD6' },
  { name: 'The Grocery Run', icon: '🛒', color: '#3BB589' },
];

function GalleryDoodles() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="none">
      <g opacity="0.07">
        <text x="8" y="104" fontSize="38" fill="#2D1B69" fontFamily="sans-serif">*</text>
        <text x="356" y="152" fontSize="26" fill="#F06B3F" fontFamily="sans-serif">+</text>
        <text x="18" y="304" fontSize="30" fill="#3BB589" fontFamily="sans-serif">*</text>
        <text x="362" y="354" fontSize="22" fill="#F5C842" fontFamily="sans-serif">*</text>
        <text x="4" y="504" fontSize="26" fill="#5B9BD6" fontFamily="sans-serif">+</text>
        <text x="356" y="582" fontSize="32" fill="#2D1B69" fontFamily="sans-serif">*</text>
        <text x="14" y="704" fontSize="24" fill="#F06B3F" fontFamily="sans-serif">*</text>
        <text x="352" y="754" fontSize="20" fill="#3BB589" fontFamily="sans-serif">+</text>
        <circle cx="378" cy="254" r="28" fill="none" stroke="#7C3AED" strokeWidth="2.5" />
        <circle cx="12" cy="454" r="22" fill="none" stroke="#F06B3F" strokeWidth="2.5" />
        <rect x="360" y="454" width="20" height="20" rx="4" fill="none" stroke="#F5C842" strokeWidth="2.5" transform="rotate(20 370 464)" />
        <rect x="4" y="604" width="17" height="17" rx="3" fill="none" stroke="#3BB589" strokeWidth="2.5" transform="rotate(-15 12 612)" />
      </g>
    </svg>
  );
}

export const GameSelectScreen: React.FC<GameSelectScreenProps> = ({
  onBack,
  onSelectMemoryGame,
  onSelectDualNBack,
  onOpenSettings,
  onNotifyRequest,
  initialTab,
  savedGameState,
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'available' | 'coming'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const gameModes: GameMode[] = [
    {
      id: 'memory-master',
      name: 'Memory Master',
      description: 'Memorize Tetris-like shapes, recreate them on the grid, and climb the leaderboard.',
      status: 'available',
      color: '#F06B3F',
      lightBg: '#FFF3EE',
      icon: '▦',
      onSelect: onSelectMemoryGame,
    },
    {
      id: 'letter-grid',
      name: 'Letter Grid',
      description: "Learn fixed letter-to-grid pairs, then recall each letter's box under pressure.",
      status: 'new',
      color: '#5B9BD6',
      lightBg: '#EEF5FF',
      icon: 'Aa',
      onSelect: onSelectDualNBack,
    },
  ];

  return (
    <div className={isMobile ? 'memory-new-shell' : 'memory-new-shell memory-new-shell-desktop'}>
      <main className="memory-gallery-new">
        <GalleryDoodles />

        <header className="memory-gallery-header">
          <button onClick={onBack} className="memory-gallery-icon-button" aria-label="Back to splash">
            <ChevronLeft size={20} />
          </button>
          <img src="/new-ui/memory-master-logo.png" alt="Memory Master" className="memory-gallery-logo" />
          <button onClick={onOpenSettings} className="memory-gallery-icon-button" aria-label="Player settings">
            <Settings size={18} />
          </button>
        </header>

        <section className="memory-gallery-title">
          <p>Choose Your Training Mode</p>
          <h1>Brain Games</h1>
          <span>Pick a challenge for memory, attention, and fast pattern recognition.</span>
        </section>

        <nav className="memory-gallery-tabs" aria-label="Game categories">
          <button className={activeTab === 'available' ? 'active' : ''} onClick={() => setActiveTab('available')}>
            🎮 Available
          </button>
          <button className={activeTab === 'coming' ? 'active' : ''} onClick={() => setActiveTab('coming')}>
            🔒 Coming Soon
          </button>
        </nav>

        <section className="memory-gallery-scroll">
          {activeTab === 'available' && (
            <div className="memory-gallery-list">
              {gameModes.map(mode => (
                <button
                  key={mode.id}
                  onClick={mode.onSelect}
                  className="memory-game-card-new"
                  style={{ borderColor: `${mode.color}28` }}
                >
                  <span className="memory-game-card-icon" style={{ backgroundColor: mode.lightBg, borderColor: `${mode.color}35` }}>
                    {mode.icon}
                  </span>
                  <span className="memory-game-card-copy">
                    <span className="memory-game-card-title-row">
                      <strong>{mode.name}</strong>
                      <em style={{ backgroundColor: mode.status === 'available' ? '#3BB589' : mode.color }}>
                        {mode.status === 'available' ? 'AVAILABLE' : 'NEW'}
                      </em>
                    </span>
                    <small>{mode.description}</small>
                    {mode.id === 'memory-master' && savedGameState && (
                      <small className="memory-game-card-resume">
                        Resume: Level {savedGameState.level} - {savedGameState.score.toLocaleString()} pts - {savedGameState.lives} {savedGameState.lives === 1 ? 'life' : 'lives'}
                      </small>
                    )}
                  </span>
                  <span className="memory-game-card-arrow" style={{ color: mode.color }}>›</span>
                </button>
              ))}

              <div className="memory-gallery-note">
                <span>🏆</span>
                <p>More games unlocking soon — keep training, champion!</p>
              </div>
            </div>
          )}

          {activeTab === 'coming' && (
            <div className="memory-coming-panel">
              <p className="memory-coming-intro">These games are in the lab — stay tuned!</p>
              <div className="memory-coming-grid">
                {comingSoon.map(game => (
                  <div key={game.name} className="memory-coming-card" style={{ borderColor: `${game.color}45` }}>
                    <div className="memory-coming-icon-wrap">
                      <span style={{ backgroundColor: `${game.color}18` }}>{game.icon}</span>
                      <i><Lock size={11} /></i>
                    </div>
                    <strong>{game.name}</strong>
                    <small>Coming soon</small>
                  </div>
                ))}
              </div>

              <button onClick={onNotifyRequest} className="memory-notify-card">
                <span>🔔</span>
                <span>
                  <strong>Get notified first!</strong>
                  <small>New games drop every month. Play daily to unlock early access.</small>
                </span>
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
