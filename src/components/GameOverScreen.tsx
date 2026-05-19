import React, { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Home, Share2, Loader2, CheckCircle2, Wallet, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface GameOverScreenProps {
  finalScore: number;
  highestLevel: number;
  onRetry: () => void;
  onBackToMenu: () => void;
  userName?: string;
  userHandle?: string;
}

type SignStatus = 'idle' | 'connecting' | 'signing' | 'saving' | 'done' | 'skipped' | 'error';

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  finalScore,
  highestLevel,
  onRetry,
  onBackToMenu,
  userName = 'Player',
  userHandle = 'player',
}) => {
  const isMobile = useIsMobile();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signStatus, setSignStatus] = useState<SignStatus>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [signError, setSignError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fid] = useState(() => localStorage.getItem('mm_fid') || 'guest_' + Date.now());

  // Auto-detect already-connected wallet
  useEffect(() => {
    const detect = async () => {
      try {
        const eth = (window as any).ethereum;
        if (!eth) return;
        const accounts: string[] = await eth.request({ method: 'eth_accounts' });
        if (accounts[0]) setWalletAddress(accounts[0]);
      } catch (_) {}
    };
    detect();
  }, []);

  const connectWallet = async () => {
    try {
      setSignStatus('connecting');
      setSignError('');
      const eth = (window as any).ethereum;
      if (!eth) { setSignError('No wallet detected. Install MetaMask or use MiniPay.'); setSignStatus('error'); return; }
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) { setWalletAddress(accounts[0]); setSignStatus('idle'); }
    } catch (e: any) {
      setSignError(e.message || 'Wallet connection failed.');
      setSignStatus('error');
    }
  };

  const saveScore = async (sig: string | null, wallet: string | null) => {
    setSignStatus('saving');
    await supabase.from('leaderboard').upsert({
      fid,
      username: userName,
      user_handle: userHandle,
      avatar: '',
      score: finalScore,
      level: highestLevel,
      wallet_address: wallet || null,
      tx_signature: sig || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fid' });
  };

  const signScore = async () => {
    if (!walletAddress) { await connectWallet(); return; }
    try {
      setSignStatus('signing');
      setSignError('');
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No wallet detected.');

      const message =
        'Memory Master — Score Proof\n\n' +
        'Player: ' + userName + ' (@' + userHandle + ')\n' +
        'Wallet: ' + walletAddress + '\n' +
        'Score: ' + finalScore.toLocaleString() + ' pts\n' +
        'Level: ' + highestLevel + '\n' +
        'Timestamp: ' + new Date().toISOString() + '\n\n' +
        'This signature verifies the score was achieved legitimately.\n' +
        'No gas fee or payment is charged.';

      const sig: string = await eth.request({ method: 'personal_sign', params: [message, walletAddress] });
      setSignature(sig);
      await saveScore(sig, walletAddress);
      setSignStatus('done');
      setShowShare(true);
    } catch (e: any) {
      if (e.code === 4001) {
        // User rejected — save without sig
        await saveScore(null, walletAddress);
        setSignStatus('skipped');
        setShowShare(true);
      } else {
        setSignError(e.message || 'Signing failed.');
        setSignStatus('error');
      }
    }
  };

  const skipSigning = async () => {
    await saveScore(null, walletAddress);
    setSignStatus('skipped');
    setShowShare(true);
  };

  const shareText =
    '🎮 I scored ' + finalScore.toLocaleString() + ' pts & reached Level ' + highestLevel + ' in Memory Master!' +
    (signature ? ' ✓ Verified on-chain' : '');
  const shareUrl = 'https://app.memorymaster.xyz';
  const fullText = shareText + '\n' + shareUrl;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = () =>
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl), '_blank');

  const shareOnFarcaster = () =>
    window.open('https://warpcast.com/~/compose?text=' + encodeURIComponent(fullText), '_blank');

  const shareOnInstagram = async () => {
    await copyToClipboard();
    alert('Caption copied! Open Instagram and paste it into your Story or post.');
    window.open('https://www.instagram.com/', '_blank');
  };

  const shareOnSnapchat = () =>
    window.open('https://www.snapchat.com/share?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(shareText), '_blank');

  return (
    <div className={isMobile ? 'mobile-game-container bg-background' : 'game-container bg-background'}>
      <div className="h-full flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-5">

          {/* Header */}
          <div>
            <div className="w-16 h-16 bg-game-error rounded-full flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Game Over!</h1>
            <p className="text-muted-foreground text-sm">Your adventure has ended</p>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted p-3 rounded-xl">
              <div className="text-2xl font-bold text-game-primary">{finalScore.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Final Score</div>
            </div>
            <div className="bg-muted p-3 rounded-xl">
              <div className="text-2xl font-bold text-game-secondary">Lv {highestLevel}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Highest Level</div>
            </div>
          </div>

          {/* Blockchain sign panel */}
          {!showShare && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center shrink-0">
                  <Trophy className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Save & Verify Score</p>
                  <p className="text-xs text-muted-foreground">Free on-chain signature — no gas</p>
                </div>
              </div>

              {walletAddress ? (
                <p className="text-xs text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)} connected
                </p>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  No wallet connected
                </p>
              )}

              {signError && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded-lg">{signError}</p>
              )}

              {(signStatus === 'idle' || signStatus === 'error') && (
                <div className="flex gap-2">
                  <Button onClick={signScore} size="sm"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                    {walletAddress
                      ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Sign & Save Score</>
                      : <><Wallet className="w-3.5 h-3.5 mr-1.5" />Connect & Sign</>}
                  </Button>
                  <Button onClick={skipSigning} size="sm" variant="outline" className="text-xs">Skip</Button>
                </div>
              )}

              {signStatus === 'connecting' && (
                <div className="flex items-center gap-2 text-xs text-indigo-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting wallet…
                </div>
              )}
              {signStatus === 'signing' && (
                <div className="flex items-center gap-2 text-xs text-indigo-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for signature in wallet…
                </div>
              )}
              {signStatus === 'saving' && (
                <div className="flex items-center gap-2 text-xs text-indigo-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving to leaderboard…
                </div>
              )}
            </div>
          )}

          {/* Share panel */}
          {showShare && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-500" />
                  Share Your Score
                </p>
                {signStatus === 'done' ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified ✓
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Saved</span>
                )}
              </div>

              {/* Score card preview */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-3 text-white text-center">
                <p className="text-xs font-medium opacity-75 mb-1">Memory Master</p>
                <p className="text-3xl font-bold">{finalScore.toLocaleString()}</p>
                <p className="text-sm opacity-90 mt-0.5">Level {highestLevel} · {userName}</p>
                {signStatus === 'done' && (
                  <p className="text-xs opacity-60 mt-1">✓ On-chain verified</p>
                )}
              </div>

              {/* Copyable text */}
              <button onClick={copyToClipboard}
                className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-xs text-muted-foreground hover:border-indigo-400 transition-colors gap-2">
                <span className="truncate">{fullText.slice(0, 55)}…</span>
                {copied
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : <Copy className="w-3.5 h-3.5 shrink-0" />}
              </button>

              {/* Social share buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={shareOnTwitter}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors">
                  <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.73-8.835L1.254 2.25H8.08l4.261 5.635L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
                  Twitter / X
                </button>
                <button onClick={shareOnFarcaster}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition-colors">
                  <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm-1 13h-2v-4a2 2 0 0 0-4 0v4H9V8h2v1.1A3.5 3.5 0 0 1 17 12v4z"/></svg>
                  Farcaster
                </button>
                <button onClick={shareOnInstagram}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-colors"
                  style={{background:'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'}}>
                  <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  Instagram
                </button>
                <button onClick={shareOnSnapchat}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-yellow-400 text-black rounded-xl text-xs font-semibold hover:bg-yellow-300 transition-colors">
                  <svg className="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24"><path d="M12.017 0C8.396 0 7.989.013 7.041.072 2.695.272.273 2.69.073 7.052.014 8 0 8.396 0 12.017c0 3.621.014 4.017.073 4.965.2 4.354 2.618 6.772 6.968 6.972.948.06 1.344.073 4.976.073 3.63 0 4.027-.014 4.975-.073 4.342-.2 6.77-2.618 6.97-6.972.06-.948.073-1.344.073-4.965 0-3.621-.014-4.017-.073-4.965C23.742 2.69 21.32.273 16.978.073 16.03.014 15.634 0 12.017 0z"/></svg>
                  Snapchat
                </button>
              </div>

              {/* On-chain signature proof */}
              {signature && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono truncate">{signature.slice(0, 22)}…</span>
                  <button onClick={() => { navigator.clipboard.writeText(signature); }}
                    className="shrink-0 text-indigo-400 hover:text-indigo-600">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2.5">
            <Button onClick={onRetry} size="lg"
              className="w-full bg-game-primary hover:bg-game-primary/90 text-white font-semibold py-3">
              <RotateCcw className="w-4 h-4 mr-2" />
              Pay 0.1 USDT to Continue
            </Button>
            <Button onClick={onBackToMenu} variant="outline" size="lg"
              className="w-full font-semibold py-3">
              <Home className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Continue from Level {highestLevel} with 3 lives restored
          </p>
        </div>
      </div>
    </div>
  );
};
