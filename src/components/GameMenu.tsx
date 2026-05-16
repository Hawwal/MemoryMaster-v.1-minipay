import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
import { useNavigate } from 'react-router-dom';
import { X, User, Settings, Trophy, Share, Volume2, VolumeX, Sun, Moon, Edit3, Save, ArrowLeft, Megaphone, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface GameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isSoundOn: boolean;
  onSoundToggle: (enabled: boolean) => void;
  isDarkMode: boolean;
  onThemeToggle: (enabled: boolean) => void;
  onLeaderboardClick: () => void;
  onShareClick: () => void;
  userName: string;
  userHandle: string;
  highestLevel: number;
  currentScore: number;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  isOpen,
  onClose,
  isSoundOn,
  onSoundToggle,
  isDarkMode,
  onThemeToggle,
  onLeaderboardClick,
  onShareClick,
  userName: initialUserName,
  userHandle: initialUserHandle,
  highestLevel,
  currentScore
}) => {
  const navigate = useNavigate();
  const [editingProfile, setEditingProfile] = useState(false);
  const [menuBannerAds, setMenuBannerAds] = useState<{id:string;media_url:string;media_type:string;click_url:string;interval_seconds:number}[]>([]);
  const [menuBannerIdx, setMenuBannerIdx] = useState(0);
  const [userName, setUserName] = useState(initialUserName);
  const [userHandle, setUserHandle] = useState(initialUserHandle);
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'profile' | 'leaderboard' | 'share'>('main');

  const handleSaveProfile = () => {
    // Save to localStorage
    localStorage.setItem('userName', userName);
    localStorage.setItem('userHandle', userHandle);
    setEditingProfile(false);
  };

  const leaderboardEntries = [
    { rank: 1, username: 'MemoryMaster', avatar: '', score: 2450, level: 15, date: 'Today' },
    { rank: 2, username: 'GridGuru', avatar: '', score: 1980, level: 12, date: 'Today' },
    { rank: 3, username: 'ShapeShifter', avatar: '', score: 1760, level: 11, date: 'Today' },
    { rank: 4, username: 'RecallKing', avatar: '', score: 1520, level: 10, date: 'Yesterday' },
    { rank: 5, username: 'PatternPro', avatar: '', score: 1340, level: 9, date: 'Yesterday' }
  ];

  const handleLeaderboardClick = () => {
    onLeaderboardClick();
    setCurrentView('leaderboard');
  };

  const handleShareClick = () => {
    onShareClick();
    setCurrentView('share');
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchMenuAds = async () => {
      try {
        const now = new Date().toISOString();
        const { data } = await supabase
          .from('ads')
          .select('id, media_url, media_type, click_url, interval_seconds')
          .eq('status', 'approved')
          .eq('ad_type', 'banner')
          .lte('starts_at', now)
          .gte('expires_at', now);
        if (data && data.length > 0) setMenuBannerAds(data);
      } catch (e) { /* silent */ }
    };
    fetchMenuAds();
  }, [isOpen]);

  useEffect(() => {
    if (menuBannerAds.length === 0) return;
    const interval = menuBannerAds[menuBannerIdx]?.interval_seconds || 10;
    const t = setInterval(() => setMenuBannerIdx(i => (i + 1) % menuBannerAds.length), interval * 1000);
    return () => clearInterval(t);
  }, [menuBannerAds, menuBannerIdx]);

  // Share View with back arrow
  if (currentView === 'share') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('main')}
                className="p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Share className="w-5 h-5 text-game-primary" />
              Share Progress
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Progress Summary */}
            <div className="bg-muted p-4 rounded-lg text-center">
              <div className="text-lg font-bold text-game-primary mb-1">
                Level {highestLevel} • {currentScore.toLocaleString()} Points
              </div>
              <div className="text-sm text-muted-foreground">
                My Memory Challenge Progress
              </div>
            </div>

            {/* Copyable Link */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Copy Game Link</h3>
              <div className="flex gap-2">
                <input
                  value={window.location.href}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded text-xs"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    // You could add a toast here
                  }}
                  size="sm"
                  variant="outline"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Social Sharing */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Share Directly</h3>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(`I scored ${currentScore.toLocaleString()} points and reached level ${highestLevel} in Memory Challenge! Can you beat me? ${window.location.href}`)}`, '_blank')}
                  variant="outline"
                  className="w-full justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500 rounded" />
                    Share on Farcaster
                  </div>
                </Button>
                
                <Button
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I scored ${currentScore.toLocaleString()} points and reached level ${highestLevel} in Memory Challenge! Can you beat me?`)}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
                  variant="outline"
                  className="w-full justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded" />
                    Share on Twitter/X
                  </div>
                </Button>
                
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied! Paste it in your Instagram bio or story.');
                  }}
                  variant="outline"
                  className="w-full justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded" />
                    Copy for Instagram
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Leaderboard View
  if (currentView === 'leaderboard') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setCurrentView('main')}
                  className="p-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Trophy className="w-5 h-5 text-game-primary" />
                Leaderboard
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            {leaderboardEntries.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {entry.rank}
                  </div>
                  <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{entry.username}</div>
                    <div className="text-xs text-muted-foreground">Level {entry.level} • {entry.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-game-primary">{entry.score.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Settings View
  if (currentView === 'settings') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentView('main')}
                className="p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSoundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <Label htmlFor="sound-toggle" className="text-sm">Sound Effects</Label>
              </div>
              <Switch
                id="sound-toggle"
                checked={isSoundOn}
                onCheckedChange={onSoundToggle}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <Label htmlFor="theme-toggle" className="text-sm">Dark Mode</Label>
              </div>
              <Switch
                id="theme-toggle"
                checked={isDarkMode}
                onCheckedChange={onThemeToggle}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Profile View
  if (currentView === 'profile') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setCurrentView('main')}
                  className="p-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <User className="w-4 h-4" />
                Profile
              </span>
              {!editingProfile && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditingProfile(true)}
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                {editingProfile ? (
                  <div className="space-y-2">
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter username"
                      className="text-sm"
                    />
                    <Input
                      value={userHandle}
                      onChange={(e) => setUserHandle(e.target.value)}
                      placeholder="Enter social handle"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile}>
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingProfile(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-sm">{userName}</div>
                    <div className="text-xs text-muted-foreground">@{userHandle}</div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Highest Level:</span>
                <span className="font-bold text-game-primary">Level {highestLevel}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Current Score:</span>
                <span className="font-medium">{currentScore.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main Menu View
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Menu</span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {/* ── Banner Ad in Menu ── */}
          {menuBannerAds.length > 0 && (() => {
            const ad = menuBannerAds[menuBannerIdx];
            return (
              <a href={ad.click_url} target="_blank" rel="noopener noreferrer"
                className="block w-full overflow-hidden rounded-xl mb-1 bg-gray-100 border border-gray-200"
                style={{ height: '40px' }} title="Advertisement">
                {ad.media_type.startsWith('video') ? (
                  <video src={ad.media_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={ad.media_url} alt="Ad" className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                )}
              </a>
            );
          })()}

          <div className="space-y-6">
            {/* Quick Profile Preview */}
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{userName}</div>
                    <div className="text-xs text-muted-foreground">@{userHandle}</div>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Highest Level:</span>
                    <span className="font-bold text-game-primary">Level {highestLevel}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Current Score:</span>
                    <span className="font-medium">{currentScore.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Options */}
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={() => setCurrentView('profile')}
              >
                <User className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={() => setCurrentView('settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={handleLeaderboardClick}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={handleShareClick}
              >
                <Share className="w-4 h-4 mr-2" />
                Share Progress
              </Button>
            </div>

            {/* Advertising */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Advertising</p>
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={() => { onClose(); navigate('/ads'); }}
              >
                <Megaphone className="w-4 h-4 mr-2 text-indigo-500" />
                Place an Ad
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-sm"
                onClick={() => { onClose(); navigate('/ads'); }}
              >
                <MessageSquare className="w-4 h-4 mr-2 text-indigo-500" />
                Request Consultation
                <span className="ml-auto text-xs text-muted-foreground">5 USDT</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};
