import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Waves as Wave, Wallet, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { WalletService, type WalletState } from '@/lib/walletService';
import { useToast } from '@/hooks/use-toast';
import CopyToClipboard from 'react-copy-to-clipboard';
import { SplashScreen } from '@/components/SplashScreen';
import { GameScreen } from '@/components/GameScreen';
import { PaymentModal } from '@/components/PaymentModal';
import { Leaderboard } from '@/components/Leaderboard';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Game wallet address to receive USDT payments
const GAME_WALLET_ADDRESS = import.meta.env.VITE_GAME_WALLET_ADDRESS || '0xde25bf927c839355c66ee3551dae8a143bf85f9a';
const GAME_PRICE = import.meta.env.VITE_GAME_PRICE || '0.1'; // 0.1 USDT

const Home = () => {
    const { toast } = useToast();
    const walletServiceRef = useRef<WalletService | null>(null);
    const [walletState, setWalletState] = useState<WalletState>({
        account: '',
        currentNetwork: '',
        isConnecting: false,
        balance: '',
        isLoadingBalance: false
    });
    const [gameState, setGameState] = useState<'splash' | 'payment' | 'game' | 'leaderboard'>('splash');
    const [finalScore, setFinalScore] = useState(0);
    const [finalLevel, setFinalLevel] = useState(1);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'daily' | 'weekly' | 'all-time'>('all-time');
    const [userName, setUserName] = useState('Player');
    const [userHandle, setUserHandle] = useState('player123');
    const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isPreparingPayment, setIsPreparingPayment] = useState(false);
    const [walletType, setWalletType] = useState<'none' | 'minipay' | 'metamask'>('none');

    // Detect wallet type on mount
    useEffect(() => {
        const detectWallet = () => {
            if (typeof window.ethereum === 'undefined') {
                setWalletType('none');
                return;
            }
            
            if ((window.ethereum as any).isMiniPay) {
                console.log('✅ MiniPay detected');
                setWalletType('minipay');
            } else if ((window.ethereum as any).isMetaMask) {
                console.log('✅ MetaMask detected');
                setWalletType('metamask');
            } else {
                console.log('✅ Generic wallet detected');
                setWalletType('metamask'); // Treat as MetaMask-compatible
            }
        };

        detectWallet();
    }, []);

    useEffect(() => {
        // Load user data from localStorage
        const savedUserName = localStorage.getItem('userName') || 'Player';
        const savedUserHandle = localStorage.getItem('userHandle') || 'player';
        
        setUserName(savedUserName);
        setUserHandle(savedUserHandle);

        const walletService = new WalletService({
            onToast: (title: string, description: string) => {
                toast({ title, description });
            }
        });

        walletService.onStateUpdate(setWalletState);
        walletServiceRef.current = walletService;

        // Load leaderboard
        fetchLeaderboard();

        return () => {
            walletService.destroy();
        };
    }, [toast]);

    // Format dates
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 24) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Fetch leaderboard
    const fetchLeaderboard = async () => {
        setIsLoadingLeaderboard(true);
        try {
            let query = supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })
                .order('level', { ascending: false })
                .limit(100);

            const now = new Date();
            if (leaderboardFilter === 'daily') {
                const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                query = query.gte('created_at', dayAgo.toISOString());
            } else if (leaderboardFilter === 'weekly') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                query = query.gte('created_at', weekAgo.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;

            const entries = (data || []).map((entry: any, index: number) => ({
                rank: index + 1,
                username: entry.username,
                userHandle: entry.user_handle,
                avatar: entry.avatar || '',
                score: entry.score,
                level: entry.level,
                date: formatDate(entry.created_at),
                fid: entry.fid
            }));

            setLeaderboardEntries(entries);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            setLeaderboardEntries([]);
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, [leaderboardFilter]);

    const connectWallet = async () => {
        await walletServiceRef.current?.connectWallet();
    };

    const disconnectWallet = () => {
        walletServiceRef.current?.disconnectWallet();
    };

    const formatAddress = (address: string) => {
        return walletServiceRef.current?.formatAddress(address) || '';
    };

    const handleStartGame = async () => {
        if (!walletState.account) {
            console.log('⚠️ Wallet not connected, prompting connection...');
            setIsPreparingPayment(true);
            
            try {
                await walletServiceRef.current?.connectWallet();
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                if (!walletState.account) {
                    throw new Error('Failed to connect wallet. Please try again.');
                }
                
                console.log('✅ Wallet connected');
            } catch (error: any) {
                console.error('Connection failed:', error);
                toast({
                    title: "Connection Failed",
                    description: error.message || "Failed to connect wallet",
                    variant: "destructive"
                });
                setIsPreparingPayment(false);
                return;
            }
        }

        setIsPreparingPayment(true);
        
        try {
            console.log('🔄 Preparing payment...');
            
            await walletServiceRef.current?.checkNetwork();
            await new Promise(resolve => setTimeout(resolve, 800));
            
            if (walletState.account) {
                await walletServiceRef.current?.fetchBalance(walletState.account);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('✅ Ready. USDT Balance:', walletState.balance);
            setGameState('payment');
        } catch (error: any) {
            console.error('Error preparing payment:', error);
            toast({
                title: "Error",
                description: "Failed to prepare payment",
                variant: "destructive"
            });
        } finally {
            setIsPreparingPayment(false);
        }
    };

    const handlePayment = async () => {
        console.log('=== USDT PAYMENT START ===');
        console.log('Wallet state:', walletState);
        console.log('Game wallet:', GAME_WALLET_ADDRESS);
        console.log('Amount:', GAME_PRICE, 'USDT');
        
        setIsProcessingPayment(true);
        
        try {
            if (!GAME_WALLET_ADDRESS || GAME_WALLET_ADDRESS === '0xYourWalletAddressHere') {
                throw new Error('Game wallet not configured');
            }
            
            if (walletState.account.toLowerCase() === GAME_WALLET_ADDRESS.toLowerCase()) {
                throw new Error('Cannot send to your own wallet');
            }

            if (!walletState.account) {
                throw new Error('Wallet disconnected');
            }

            const success = await walletServiceRef.current?.sendPayment(
                GAME_WALLET_ADDRESS,
                GAME_PRICE
            );

            if (success) {
                toast({
                    title: "Payment Successful!",
                    description: `${GAME_PRICE} USDT sent successfully. Starting game...`
                });
                
                setTimeout(() => {
                    setIsProcessingPayment(false);
                    setGameState('game');
                }, 1500);
            } else {
                throw new Error('Payment failed');
            }
        } catch (error: any) {
            console.error('❌ Payment error:', error);
            toast({
                title: "Payment Failed",
                description: error.message || "Unable to process payment",
                variant: "destructive"
            });
            setIsProcessingPayment(false);
        }
    };

    const handlePaymentRequest = () => {
        setGameState('payment');
    };

    const handleGameEnd = async (score: number, level: number) => {
        setFinalScore(score);
        setFinalLevel(level);
        
        try {
            const fid = localStorage.getItem('fid') || `guest_${Date.now()}`;
            
            const { data: existing, error: fetchError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('fid', fid)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (existing) {
                if (score > existing.score || (score === existing.score && level > existing.level)) {
                    const { error: updateError } = await supabase
                        .from('leaderboard')
                        .update({
                            username: userName,
                            user_handle: userHandle,
                            score,
                            level,
                            updated_at: new Date().toISOString()
                        })
                        .eq('fid', fid);

                    if (updateError) throw updateError;
                    console.log('✅ Score updated');
                }
            } else {
                const { error: insertError } = await supabase
                    .from('leaderboard')
                    .insert({
                        fid,
                        username: userName,
                        user_handle: userHandle,
                        score,
                        level,
                        avatar: '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
                console.log('✅ Score submitted');
            }
            
            await fetchLeaderboard();
        } catch (error) {
            console.error('❌ Score submission error:', error);
        }
        
        setGameState('leaderboard');
    };

    const { account, currentNetwork, isConnecting, balance, isLoadingBalance } = walletState;

    if (gameState === 'splash') {
        return (
            <div className="relative">
                <SplashScreen onStartGame={handleStartGame} />
                {isPreparingPayment && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="bg-card p-8 rounded-xl shadow-2xl max-w-sm mx-4">
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-game-primary border-t-transparent"></div>
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-foreground mb-1">Preparing Payment</p>
                                    <p className="text-sm text-muted-foreground">
                                        {!account ? 'Connecting wallet...' : 'Checking USDT balance...'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (gameState === 'payment') {
        return (
            <PaymentModal
                isOpen={true}
                onClose={() => setGameState('splash')}
                onPayment={handlePayment}
                isLoading={isProcessingPayment}
            />
        );
    }

    if (gameState === 'game') {
        return (
            <GameScreen 
                onGameEnd={handleGameEnd} 
                userName={userName}
                userHandle={userHandle}
                onPaymentRequest={handlePaymentRequest}
            />
        );
    }

    if (gameState === 'leaderboard') {
        return (
            <div className="min-h-screen bg-background p-4">
                <div className="container mx-auto max-w-2xl">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold text-foreground mb-2">Game Over!</h2>
                        <p className="text-lg text-muted-foreground">
                            Final Score: <span className="font-bold text-game-primary">{finalScore.toLocaleString()}</span>
                        </p>
                        <p className="text-lg text-muted-foreground">
                            Highest Level: <span className="font-bold text-game-secondary">Level {finalLevel}</span>
                        </p>
                    </div>
                    <Leaderboard
                        entries={leaderboardEntries}
                        filter={leaderboardFilter}
                        onFilterChange={setLeaderboardFilter}
                        isLoading={isLoadingLeaderboard}
                    />
                    <div className="text-center mt-6">
                        <button
                            onClick={() => setGameState('splash')}
                            className="bg-game-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-game-primary/90 transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="container mx-auto px-4 max-w-md">
                <div className="bg-card rounded-xl shadow-lg p-6">
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center mb-2">
                            <Wave className="w-8 h-8 text-purple-500 mr-2" />
                            <h1 className="text-3xl font-bold text-foreground">
                                {walletType === 'minipay' ? 'MiniPay' : walletType === 'metamask' ? 'MetaMask' : 'Wallet'}
                            </h1>
                        </div>
                        <p className="text-muted-foreground">USDT on Celo Mainnet</p>
                    </div>
                    
                    {!account ? (
                        <div className="space-y-3">
                            <button 
                                className="w-full bg-primary text-primary-foreground font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-50"
                                onClick={connectWallet}
                                disabled={isConnecting}
                            >
                                <Wallet size={20} />
                                {isConnecting ? 'Connecting...' : `Connect ${walletType === 'minipay' ? 'MiniPay' : walletType === 'metamask' ? 'MetaMask' : 'Wallet'}`}
                            </button>
                            
                            {walletType === 'none' && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                    <p className="text-sm text-amber-600 dark:text-amber-400">
                                        ⚠️ No wallet detected. Please use:
                                    </p>
                                    <ul className="text-sm text-amber-600 dark:text-amber-400 mt-2 ml-4 space-y-1">
                                        <li>• MiniPay app (recommended)</li>
                                        <li>• MetaMask on CELO Mainnet</li>
                                    </ul>
                                </div>
                            )}
                            
                            {walletType === 'metamask' && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                        ℹ️ Make sure MetaMask is connected to CELO Mainnet (Chain ID: 42220)
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-muted rounded-xl p-6">
                            <h3 className="text-game-success font-medium mb-4 flex items-center gap-2">
                                <CheckCircle size={20} />
                                {walletType === 'minipay' ? 'MiniPay' : 'MetaMask'} Connected
                            </h3>
                            
                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-1">Account:</label>
                                <div className="flex items-center bg-background p-2 rounded gap-2">
                                    <code className="flex-1 text-sm">{formatAddress(account)}</code>
                                    <CopyToClipboard 
                                        text={account}
                                        onCopy={() => toast({ title: "Copied!", description: "Address copied" })}
                                    >
                                        <button className="p-1.5 border border-border rounded hover:bg-accent">
                                            <Copy size={14} />
                                        </button>
                                    </CopyToClipboard>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="text-sm font-medium block mb-1">USDT Balance:</label>
                                <div className="flex items-center bg-background p-2 rounded border">
                                    {isLoadingBalance ? (
                                        <span className="text-sm text-muted-foreground">Loading...</span>
                                    ) : (
                                        <span className="text-sm font-mono">{balance} USDT</span>
                                    )}
                                </div>
                            </div>

                            {currentNetwork && (
                                <div className="mb-4">
                                    <label className="text-sm font-medium block mb-1">Network:</label>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        currentNetwork === 'Celo Mainnet'
                                            ? 'bg-game-success/20 text-game-success' 
                                            : 'bg-game-error/20 text-game-error'
                                    }`}>
                                        {currentNetwork === 'Celo Mainnet' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                        {currentNetwork}
                                    </span>
                                </div>
                            )}

                            <hr className="my-4" />

                            <button 
                                className="w-full bg-game-error hover:bg-game-error/90 text-white font-medium py-3 px-4 rounded-lg"
                                onClick={disconnectWallet}
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const App = () => {
    return (
        <>
            <Routes>
                <Route path="/" element={<Home />} />
            </Routes>
            <Toaster />
        </>
    );
};

export default App;