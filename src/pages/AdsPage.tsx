import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { WalletService, AD_TIERS, type AdTier } from '@/lib/walletService';
import {
  Upload, Link2, ChevronRight, Check, Wallet,
  MessageSquare, Zap, Clock, Calendar, ArrowLeft, Loader2,
  AlertCircle, CheckCircle2, Megaphone, X
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTION_URL;

type Step = 'home' | 'ad-tier' | 'ad-upload' | 'ad-success' |
            'consultation-pay' | 'consultation-form' | 'consultation-success';

export const AdsPage: React.FC = () => {
  const navigate = useNavigate();
  const walletServiceRef = useRef<WalletService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('home');
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Ad state
  const [selectedTier, setSelectedTier] = useState<AdTier | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(3);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [advertiserEmail, setAdvertiserEmail] = useState('');

  // Consultation state
  const [consultationTxHash, setConsultationTxHash] = useState('');
  const [consultName, setConsultName] = useState('');
  const [consultEmail, setConsultEmail] = useState('');
  const [consultMessage, setConsultMessage] = useState('');

  useEffect(() => {
    const ws = new WalletService({ onToast: () => {} });
    ws.onStateUpdate((state) => setWalletAddress(state.account));
    walletServiceRef.current = ws;
    return () => ws.destroy();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError('');
    try {
      await walletServiceRef.current?.connectWallet();
    } catch (e: any) {
      setError(e.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/gif', 'video/mp4'];
    if (!allowed.includes(file.type)) { setError('Only JPEG, GIF, or MP4 files are allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10MB.'); return; }
    setMediaFile(file);
    setError('');
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleAdPayment = async () => {
    if (!selectedTier) return;
    if (!mediaFile) { setError('Please upload your ad creative.'); return; }
    if (!clickUrl) { setError('Please enter a destination URL.'); return; }
    if (!clickUrl.startsWith('http')) { setError('URL must start with http:// or https://'); return; }
    if (!walletAddress) { setError('Please connect your wallet first.'); return; }

    setIsProcessing(true);
    setError('');

    try {
      // 1. Upload media
      setUploadProgress(20);
      const ext = mediaFile.name.split('.').pop();
      const fileName = `${Date.now()}_${walletAddress.slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('ad-media')
        .upload(fileName, mediaFile, { contentType: mediaFile.type });

      if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

      setUploadProgress(50);

      const { data: { publicUrl } } = supabase.storage
        .from('ad-media')
        .getPublicUrl(fileName);

      // 2. Pay on-chain
      setUploadProgress(65);
      const result = await walletServiceRef.current!.payForAd(selectedTier, intervalSeconds);

      setUploadProgress(85);

      // 3. Save to Supabase
      const { error: dbError } = await supabase.from('ads').insert({
        advertiser_wallet: result.walletAddress,
        advertiser_email: advertiserEmail || null,
        media_url: publicUrl,
        media_type: mediaFile.type,
        click_url: clickUrl,
        tier: selectedTier.id,
        usdt_paid: parseFloat(selectedTier.usdtAmount),
        daily_minutes: selectedTier.dailyMinutes,
        interval_seconds: result.intervalSeconds,
        validity_days: selectedTier.validityDays,
        tx_hash: result.txHash,
        status: 'pending',
      });

      if (dbError) throw new Error('Failed to save ad: ' + dbError.message);

      setUploadProgress(100);
      setStep('ad-success');
    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleConsultationPayment = async () => {
    if (!walletAddress) { setError('Please connect your wallet first.'); return; }
    setIsProcessing(true);
    setError('');
    try {
      const result = await walletServiceRef.current!.payForConsultation();
      setConsultationTxHash(result.txHash);
      setStep('consultation-form');
    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConsultationSubmit = async () => {
    if (!consultName || !consultEmail || !consultMessage) { setError('Please fill in all fields.'); return; }
    if (!consultEmail.includes('@')) { setError('Please enter a valid email address.'); return; }

    setIsProcessing(true);
    setError('');

    try {
      const { error: dbError } = await supabase.from('consultation_requests').insert({
        wallet_address: walletAddress,
        tx_hash: consultationTxHash,
        name: consultName,
        email: consultEmail,
        message: consultMessage,
      });
      if (dbError) throw new Error('Failed to save request');

      const res = await fetch(`${SUPABASE_FUNCTION_URL}/send-consultation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: consultName,
          email: consultEmail,
          message: consultMessage,
          wallet_address: walletAddress,
          tx_hash: consultationTxHash,
        }),
      });
      if (!res.ok) throw new Error('Failed to send email');

      setStep('consultation-success');
    } catch (e: any) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const WalletGuard = ({ children }: { children: React.ReactNode }) => {
    if (!walletAddress) {
      return (
        <div className="text-center py-6">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-indigo-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">Connect your wallet to continue</p>
          <p className="text-xs text-gray-400 mb-5">MiniPay or MetaMask on Celo Mainnet</p>
          <button onClick={connectWallet} disabled={isConnecting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-2 mx-auto">
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      );
    }
    return <>{children}</>;
  };

  // ─── Step renders ─────────────────────────────────────────────────────────

  const renderHome = () => (
    <div className="space-y-5">
      <div className="text-center pt-2 pb-1">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium mb-3">
          <Megaphone className="w-3.5 h-3.5" /> Advertise on Memory Master
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reach Active Players</h1>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Your ad shown to engaged players during gameplay — banner bar + popup slots.
        </p>
      </div>

      {/* Wallet status */}
      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${walletAddress ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">{walletAddress ? formatAddress(walletAddress) : 'No wallet connected'}</span>
        </div>
        {!walletAddress && (
          <button onClick={connectWallet} disabled={isConnecting}
            className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
            {isConnecting && <Loader2 className="w-3 h-3 animate-spin" />} Connect
          </button>
        )}
      </div>

      {/* Tiers grid */}
      <div className="grid grid-cols-2 gap-2">
        {AD_TIERS.map((tier) => (
          <div key={tier.id} className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-3">
            <div className="text-base font-bold text-indigo-600 mb-1">{tier.usdtAmount} USDT</div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tier.dailyMinutes} min/day</div>
              <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {tier.validityDays} days</div>
              {tier.canSelectInterval && <div className="text-indigo-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Custom interval</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Dimensions */}
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1.5">
        <p className="font-semibold">Ad Dimensions Required</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="font-bold text-blue-800">Banner</div>
            <div>728 × 90 px</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="font-bold text-blue-800">Popup</div>
            <div>400 × 300 px</div>
          </div>
        </div>
        <p className="text-blue-500">JPEG · GIF · MP4 — Max 10MB</p>
      </div>

      <button onClick={() => setStep('ad-tier')}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200">
        <Megaphone className="w-4 h-4" /> Place an Ad <ChevronRight className="w-4 h-4" />
      </button>

      <button onClick={() => setStep('consultation-pay')}
        className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        Request Consultation <span className="text-xs text-gray-400">(5 USDT)</span>
      </button>
    </div>
  );

  const renderTierSelect = () => (
    <div className="space-y-4">
      <button onClick={() => setStep('home')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Choose Your Plan</h2>
        <p className="text-xs text-gray-400 mt-0.5">Banner + popup slots included in all plans</p>
      </div>
      <WalletGuard>
        <div className="space-y-2">
          {AD_TIERS.map((tier) => (
            <button key={tier.id} onClick={() => { setSelectedTier(tier); setIntervalSeconds(tier.intervalSeconds); }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                selectedTier?.id === tier.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'
              }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-lg font-bold text-gray-900">{tier.usdtAmount} USDT</span>
                {selectedTier?.id === tier.id && <Check className="w-4 h-4 text-indigo-600" />}
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-indigo-400" />{tier.dailyMinutes} min/day</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-indigo-400" />{tier.validityDays} days</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-indigo-400" />{tier.canSelectInterval ? '3–10s' : '3s'}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedTier?.canSelectInterval && (
          <div className="bg-indigo-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-2">
              Display Interval: <span className="text-indigo-600">{intervalSeconds}s</span>
            </p>
            <input type="range" min={3} max={10} step={1} value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(parseInt(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-indigo-400 mt-1">
              <span>3s (more frequent)</span><span>10s (longer view)</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button onClick={() => { if (selectedTier) { setError(''); setStep('ad-upload'); } else setError('Please select a plan first'); }}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
          Continue to Upload <ChevronRight className="w-4 h-4" />
        </button>
      </WalletGuard>
    </div>
  );

  const renderUpload = () => (
    <div className="space-y-4">
      <button onClick={() => setStep('ad-tier')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload Creative</h2>
        <p className="text-xs text-gray-400 mt-0.5">JPEG · GIF · MP4 — max 10MB</p>
      </div>

      {/* Upload zone */}
      <div onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
          mediaFile ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/gif,video/mp4"
          onChange={handleFileSelect} className="hidden" />
        {mediaPreview ? (
          <div className="space-y-2">
            {mediaFile?.type.startsWith('video') ? (
              <video src={mediaPreview} className="w-full max-h-40 rounded-lg object-contain mx-auto" controls />
            ) : (
              <img src={mediaPreview} alt="Preview" className="w-full max-h-40 rounded-lg object-contain mx-auto" />
            )}
            <p className="text-xs text-indigo-600 font-medium">{mediaFile?.name}</p>
            <p className="text-xs text-gray-400">Click to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600">Click to upload</p>
            <p className="text-xs text-gray-400">Banner: 728×90px · Popup: 400×300px</p>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1.5">
          <Link2 className="w-3.5 h-3.5 inline mr-1" />Destination URL
        </label>
        <input type="url" placeholder="https://yourwebsite.com" value={clickUrl}
          onChange={(e) => setClickUrl(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-1.5">
          Email <span className="text-gray-400 font-normal text-xs">(optional — for status updates)</span>
        </label>
        <input type="email" placeholder="you@example.com" value={advertiserEmail}
          onChange={(e) => setAdvertiserEmail(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
        <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Order Summary</p>
        <div className="flex justify-between text-gray-600 text-xs">
          <span>Plan</span><span className="font-medium">{selectedTier?.usdtAmount} USDT</span>
        </div>
        <div className="flex justify-between text-gray-600 text-xs">
          <span>Daily display</span><span>{selectedTier?.dailyMinutes} min/day for {selectedTier?.validityDays} days</span>
        </div>
        <div className="flex justify-between text-gray-600 text-xs">
          <span>Interval</span><span>{intervalSeconds}s per slot</span>
        </div>
      </div>

      {isProcessing && uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-center">{uploadProgress}% complete</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-500 bg-red-50 p-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={handleAdPayment} disabled={isProcessing || !mediaFile || !clickUrl}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
        {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <>Pay {selectedTier?.usdtAmount} USDT & Submit</>}
      </button>
    </div>
  );

  const renderAdSuccess = () => (
    <div className="text-center py-6 space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Ad Submitted!</h2>
      <p className="text-gray-400 text-sm max-w-xs mx-auto">
        Your ad is under review. Once approved it enters rotation automatically based on your plan.
      </p>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left text-xs text-amber-700 space-y-1">
        <p className="font-semibold text-sm mb-2">What happens next</p>
        <p>• Admin reviews your creative (usually within 24 hours)</p>
        <p>• Approved ads enter rotation automatically</p>
        <p>• {selectedTier?.dailyMinutes} min/day starts from approval date</p>
        <p>• Ad runs for {selectedTier?.validityDays} days total</p>
      </div>
      <button onClick={() => { setStep('home'); setMediaFile(null); setMediaPreview(''); setClickUrl(''); setSelectedTier(null); setAdvertiserEmail(''); }}
        className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold">Done</button>
    </div>
  );

  const renderConsultationPay = () => (
    <div className="space-y-4">
      <button onClick={() => setStep('home')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Request Consultation</h2>
        <p className="text-xs text-gray-400 mt-0.5">Direct advice on your advertising strategy</p>
      </div>
      <WalletGuard>
        <div className="bg-indigo-50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">One-on-one Consultation</p>
              <p className="text-xs text-gray-500">Message directly to Hawwal Ogungbadero</p>
            </div>
          </div>
          <div className="border-t border-indigo-100 pt-3 space-y-1.5 text-sm text-gray-600">
            <div className="flex justify-between"><span>Fee</span><span className="font-bold">5 USDT</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Response time</span><span>Within 48 hours</span></div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-500 bg-red-50 p-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        <button onClick={handleConsultationPayment} disabled={isProcessing}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <>Pay 5 USDT & Continue</>}
        </button>
      </WalletGuard>
    </div>
  );

  const renderConsultationForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl text-xs font-medium">
        <CheckCircle2 className="w-4 h-4 shrink-0" />Payment confirmed — complete your request below
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Your Message</h2>
        <p className="text-xs text-gray-400 mt-0.5">We'll reply to your email within 48 hours</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Your Name</label>
          <input type="text" placeholder="Full name" value={consultName}
            onChange={(e) => setConsultName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Email Address</label>
          <input type="email" placeholder="your@email.com" value={consultEmail}
            onChange={(e) => setConsultEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Message</label>
          <textarea placeholder="What would you like to discuss?" value={consultMessage}
            onChange={(e) => setConsultMessage(e.target.value)} rows={4}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-red-500 bg-red-50 p-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={handleConsultationSubmit} disabled={isProcessing}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
        {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <>Send Message</>}
      </button>
    </div>
  );

  const renderConsultationSuccess = () => (
    <div className="text-center py-6 space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Message Sent!</h2>
      <p className="text-gray-400 text-sm max-w-xs mx-auto">
        Your request has been received. Expect a reply to <strong className="text-gray-600">{consultEmail}</strong> within 48 hours.
      </p>
      <button onClick={() => navigate('/')}
        className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold">Back to Game</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-start justify-center p-4 pt-8 pb-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100/40 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Memory Master Ads</span>
          {walletAddress ? (
            <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg font-medium">
              {formatAddress(walletAddress)}
            </div>
          ) : <div className="w-8" />}
        </div>

        {step === 'home' && renderHome()}
        {step === 'ad-tier' && renderTierSelect()}
        {step === 'ad-upload' && renderUpload()}
        {step === 'ad-success' && renderAdSuccess()}
        {step === 'consultation-pay' && renderConsultationPay()}
        {step === 'consultation-form' && renderConsultationForm()}
        {step === 'consultation-success' && renderConsultationSuccess()}
      </div>
    </div>
  );
};
