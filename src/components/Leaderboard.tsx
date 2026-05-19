import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Award, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface LeaderboardEntry {
  rank: number;
  username: string;
  userHandle?: string;
  avatar?: string;
  score: number;
  level: number;
  date: string;
  fid?: string;
  tx_signature?: string;
}

interface LeaderboardProps {
  filter: 'daily' | 'weekly' | 'all-time';
  onFilterChange: (filter: 'daily' | 'weekly' | 'all-time') => void;
  // Optional: still accept static entries as fallback
  entries?: LeaderboardEntry[];
  isLoading?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  filter,
  onFilterChange,
  entries: staticEntries,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(staticEntries || []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      let query = supabase
        .from('leaderboard')
        .select('id, fid, username, user_handle, avatar, score, level, created_at, tx_signature')
        .order('score', { ascending: false })
        .limit(50);

      const now = new Date();
      if (filter === 'daily') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        query = query.gte('created_at', start.toISOString());
      } else if (filter === 'weekly') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        query = query.gte('created_at', start.toISOString());
      }

      const { data, error: dbError } = await query;
      if (dbError) throw dbError;

      const formatted: LeaderboardEntry[] = (data || []).map((row, i) => ({
        rank: i + 1,
        username: row.username,
        userHandle: row.user_handle,
        avatar: row.avatar || '',
        score: row.score,
        level: row.level,
        date: new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        fid: row.fid,
        tx_signature: row.tx_signature,
      }));
      setEntries(formatted);
    } catch (e: any) {
      setError('Could not load leaderboard. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground font-semibold text-sm">#{rank}</span>;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 border-yellow-500';
    if (rank === 2) return 'bg-gray-400/20 border-gray-400';
    if (rank === 3) return 'bg-amber-600/20 border-amber-600';
    return 'bg-muted border-border';
  };

  return (
    <div className="bg-card rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-game-primary" />
          Leaderboard
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeaderboard}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'all-time'] as const).map(f => (
              <button key={f} onClick={() => onFilterChange(f)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-game-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {f === 'all-time' ? 'All Time' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-center py-4 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-muted rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-muted-foreground/20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted-foreground/20 rounded w-1/3" />
                  <div className="h-3 bg-muted-foreground/20 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No entries yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Be the first to play and claim the top spot!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.fid + '-' + entry.rank}
              className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all hover:shadow-md ${getRankBadgeColor(entry.rank)}`}>
              <div className="flex items-center justify-center w-10">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">{entry.username}</h3>
                  {entry.userHandle && (
                    <span className="text-xs text-muted-foreground">@{entry.userHandle}</span>
                  )}
                  {entry.tx_signature && (
                    <span className="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-full"
                      title={'Signature: ' + entry.tx_signature.slice(0, 20) + '…'}>
                      ✓ verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-medium text-game-primary">{entry.score.toLocaleString()} pts</span>
                  <span className="text-game-secondary">Level {entry.level}</span>
                  <span className="text-xs">{entry.date}</span>
                </div>
              </div>
              {entry.rank <= 3 && (
                <div className="hidden sm:block text-2xl">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
