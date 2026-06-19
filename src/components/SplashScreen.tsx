import React from 'react';
import { Brain, Settings, Trophy } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SavedGameState } from '@/App';

interface SplashScreenProps {
  onStartGame: (initialTab?: 'available' | 'coming') => void;
  onOpenSettings: () => void;
  savedGameState: SavedGameState | null;
}

function SplashDoodles() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="none">
      <g opacity="0.35">
        <text x="16" y="58" fontSize="24" fill="#F5C842" fontFamily="sans-serif">*</text>
        <text x="344" y="44" fontSize="16" fill="#3BB589" fontFamily="sans-serif">*</text>
        <text x="198" y="28" fontSize="11" fill="white" fontFamily="sans-serif">*</text>
        <text x="128" y="72" fontSize="9" fill="#F06B3F" fontFamily="sans-serif">+</text>
        <text x="262" y="82" fontSize="11" fill="#F5C842" fontFamily="sans-serif">+</text>
        <text x="360" y="116" fontSize="9" fill="white" fontFamily="sans-serif">*</text>
        <text x="14" y="205" fontSize="13" fill="#F5C842" fontFamily="sans-serif">*</text>
        <text x="370" y="235" fontSize="17" fill="#3BB589" fontFamily="sans-serif">*</text>
        <text x="8" y="355" fontSize="11" fill="white" fontFamily="sans-serif">+</text>
        <text x="368" y="408" fontSize="13" fill="#F5C842" fontFamily="sans-serif">*</text>
        <text x="24" y="658" fontSize="15" fill="#3BB589" fontFamily="sans-serif">*</text>
        <text x="354" y="604" fontSize="11" fill="white" fontFamily="sans-serif">*</text>
        <text x="178" y="725" fontSize="9" fill="#F06B3F" fontFamily="sans-serif">+</text>
        <text x="78" y="784" fontSize="13" fill="#F5C842" fontFamily="sans-serif">*</text>
        <text x="304" y="764" fontSize="11" fill="white" fontFamily="sans-serif">*</text>
      </g>
      <g opacity="0.45">
        <rect x="20" y="132" width="13" height="13" rx="3" fill="#F06B3F" />
        <rect x="358" y="162" width="11" height="11" rx="2" fill="#3BB589" />
        <rect x="342" y="682" width="15" height="15" rx="3" fill="#F5C842" />
        <rect x="16" y="704" width="11" height="11" rx="2" fill="#5B9BD6" />
        <rect x="372" y="744" width="9" height="9" rx="2" fill="#F06B3F" />
        <rect x="186" y="60" width="8" height="8" rx="2" fill="#F5C842" transform="rotate(20 190 64)" />
        <rect x="340" y="560" width="10" height="10" rx="2" fill="#F06B3F" transform="rotate(-15 345 565)" />
      </g>
      <g opacity="0.18">
        <circle cx="368" cy="308" r="22" fill="none" stroke="white" strokeWidth="2.5" />
        <circle cx="18" cy="456" r="16" fill="none" stroke="#F5C842" strokeWidth="2.5" />
        <circle cx="376" cy="556" r="13" fill="none" stroke="#3BB589" strokeWidth="2.5" />
        <circle cx="20" cy="168" r="10" fill="none" stroke="#5B9BD6" strokeWidth="2" />
      </g>
    </svg>
  );
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onStartGame, onOpenSettings }) => {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? 'memory-new-shell' : 'memory-new-shell memory-new-shell-desktop'}>
      <main className="memory-splash-new">
        <SplashDoodles />

        <button onClick={onOpenSettings} className="memory-splash-settings" aria-label="Player settings">
          <Settings size={18} />
        </button>

        <img src="/new-ui/memory-master-logo.png" alt="Memory Master" className="memory-splash-logo" />
        <img src="/new-ui/memory-mountain.png" alt="Memory Master mountain" className="memory-splash-mountain" />

        <p className="memory-splash-tagline">Train your brain. Master your memory.</p>

        <section className="memory-splash-badges" aria-label="Game highlights">
          <div>
            <span style={{ backgroundColor: 'rgba(245, 200, 66, 0.15)' }}>
              <Brain size={20} color="#F5C842" />
            </span>
            <strong>Memory<br />Test</strong>
          </div>
          <div>
            <span style={{ backgroundColor: 'rgba(91, 155, 214, 0.15)' }}>
              <Trophy size={20} color="#5B9BD6" />
            </span>
            <strong>Leader-<br />board</strong>
          </div>
        </section>

        <button onClick={() => onStartGame('available')} className="memory-splash-play">
          <span>▶</span>
          Play Now
        </button>

        <button onClick={() => onStartGame('coming')} className="memory-splash-link">
          View all game modes -&gt;
        </button>

        <p className="memory-splash-footer">Built by Hawwal on Celo</p>
      </main>
    </div>
  );
};
