import React, { useEffect, useState } from 'react';
import { Calendar, Info, Mail, Trophy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface PlayerProfile {
  username: string;
  age: string;
  email: string;
}

interface PlayerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: PlayerProfile;
  onSaveProfile: (profile: PlayerProfile) => void;
  leaderboardEntries: Array<{
    rank?: number;
    username?: string;
    score?: number;
    level?: number;
  }>;
}

const aboutText =
  'Memory Master is a fast-paced pattern challenge game that combines cognitive training with competitive gaming. Players observe patterns, recreate them under pressure, and climb the leaderboard while training memory, attention, and recognition speed.';

export const PlayerSettingsDialog: React.FC<PlayerSettingsDialogProps> = ({
  open,
  onOpenChange,
  profile,
  onSaveProfile,
  leaderboardEntries,
}) => {
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile, open]);

  const updateDraft = (field: keyof PlayerProfile, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSaveProfile({
      username: draft.username.trim() || 'Player',
      age: draft.age.trim(),
      email: draft.email.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#7C3AED]" />
            Player Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1A0F3A]">
                <User className="w-4 h-4" />
                Username
              </span>
              <input
                value={draft.username}
                onChange={event => updateDraft('username', event.target.value)}
                className="w-full rounded-2xl border border-[#E5DDD5] bg-white px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"
                placeholder="Player"
              />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1A0F3A]">
                <Calendar className="w-4 h-4" />
                Age
              </span>
              <input
                value={draft.age}
                onChange={event => updateDraft('age', event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                className="w-full rounded-2xl border border-[#E5DDD5] bg-white px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1A0F3A]">
                <Mail className="w-4 h-4" />
                Email
              </span>
              <input
                value={draft.email}
                onChange={event => updateDraft('email', event.target.value)}
                className="w-full rounded-2xl border border-[#E5DDD5] bg-white px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"
                inputMode="email"
                placeholder="you@example.com"
              />
            </label>

            <Button onClick={handleSave} className="w-full rounded-2xl bg-[#1A0F3A] text-white hover:bg-[#2D1B69]">
              Save Profile
            </Button>
          </section>

          <section className="rounded-3xl border border-[#E5DDD5] bg-[#FFFBF5] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#1A0F3A]">
              <Trophy className="w-4 h-4 text-[#F5C842]" />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {leaderboardEntries.slice(0, 5).length === 0 ? (
                <p className="text-xs text-[#6B5E8A]">No leaderboard scores yet.</p>
              ) : (
                leaderboardEntries.slice(0, 5).map((entry, index) => (
                  <div key={`${entry.username}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-xs">
                    <span className="font-bold text-[#1A0F3A]">#{entry.rank || index + 1} {entry.username || 'Player'}</span>
                    <span className="text-[#6B5E8A]">{(entry.score || 0).toLocaleString()} pts</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#E5DDD5] bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-[#1A0F3A]">
              <Info className="w-4 h-4 text-[#3BB589]" />
              About Memory Master
            </h3>
            <p className="text-sm leading-relaxed text-[#6B5E8A]">{aboutText}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
