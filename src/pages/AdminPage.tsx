import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
  Shield, LogOut, Eye, Check, X, Trash2, Plus, Users,
  MessageSquare, Megaphone, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Calendar, Loader2,
  ChevronDown, ChevronUp, Video, Upload, Link, ImageIcon, PenLine, Wallet
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type Tab = 'ads' | 'consultations' | 'admins';
type AdStatus = 'pending' | 'approved' | 'rejected' | 'expired';

interface Ad {
  id: string;
  advertiser_wallet: string;
  advertiser_email: string | null;
  media_url: string;
  media_type: string;
  click_url: string;
  tier: string;
  usdt_paid: number;
  daily_minutes: number;
  interval_seconds: number;
  validity_days: number;
  status: AdStatus;
  tx_hash: string | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Consultation {
  id: string;
  wallet_address: string;
  tx_hash: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
}

interface Admin {
  id: string;
  username: string;
  created_at: string;
}

const AD_TIERS = ['basic', 'standard', 'premium', 'enterprise'];

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const adFileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('ads');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [expandedAd, setExpandedAd] = useState<string | null>(null);
  const [expandedConsult, setExpandedConsult] = useState<string | null>(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [ads, setAds] = useState<Ad[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adFilter, setAdFilter] = useState<AdStatus | 'all'>('pending');

  // ── Add Admin form ────────────────────────────────────────────────────────
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // ── Add Ad form ───────────────────────────────────────────────────────────
  const [showAddAd, setShowAddAd] = useState(false);
  const [isSubmittingAd, setIsSubmittingAd] = useState(false);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<'idle' | 'signing' | 'signed' | 'skipped'>('idle');
  const [adSignature, setAdSignature] = useState<string | null>(null);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [addAdError, setAddAdError] = useState('');
  const [adMediaMode, setAdMediaMode] = useState<'upload' | 'url'>('upload');
  const [adMediaFile, setAdMediaFile] = useState<File | null>(null);
  const [adMediaUrlInput, setAdMediaUrlInput] = useState('');
  const [adMediaPreview, setAdMediaPreview] = useState('');
  const [adClickUrl, setAdClickUrl] = useState('');
  const [adAdvertiserEmail, setAdAdvertiserEmail] = useState('');
  const [adAdvertiserWallet, setAdAdvertiserWallet] = useState('');
  const [adTier, setAdTier] = useState('basic');
  const [adDailyMinutes, setAdDailyMinutes] = useState('5');
  const [adIntervalSeconds, setAdIntervalSeconds] = useState('3');
  const [adValidityDays, setAdValidityDays] = useState('7');

  // ── Session restore ───────────────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_session');
    if (saved) { setCurrentAdmin(saved); setIsAuthenticated(true); }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) { setLoginError('Please enter username and password.'); return; }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id, username, password_hash')
        .eq('username', loginUsername.toLowerCase())
        .single();

      if (error || !data) { setLoginError('Invalid username or password.'); return; }

      const hashedInput = await hashPassword(loginPassword);
      if (data.password_hash !== hashedInput) {
        setLoginError('Invalid username or password.');
        return;
      }

      setCurrentAdmin(data.username);
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_session', data.username);
    } catch (e: any) {
      setLoginError(e.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentAdmin('');
    sessionStorage.removeItem('admin_session');
  };

  const showAction = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const statusColor: Record<AdStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-500',
  };

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('ads').select('*').order('created_at', { ascending: false });
      if (adFilter !== 'all') query = query.eq('status', adFilter);
      const { data, error } = await query;
      if (error) throw error;
      setAds(data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [adFilter]);

  const fetchConsultations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultation_requests').select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setConsultations(data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admins').select('id, username, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAdmins(data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'ads') fetchAds();
    if (activeTab === 'consultations') fetchConsultations();
    if (activeTab === 'admins') fetchAdmins();
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'ads') fetchAds();
  }, [adFilter]);

  // ── Ad actions ────────────────────────────────────────────────────────────
  const approveAd = async (ad: Ad) => {
    try {
      const now = new Date();
      const expires = new Date(now);
      expires.setDate(expires.getDate() + ad.validity_days);
      const { error } = await supabase.from('ads').update({
        status: 'approved',
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
      }).eq('id', ad.id);
      if (error) throw error;
      showAction('✅ Ad approved and scheduled');
      fetchAds();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

  const rejectAd = async (id: string) => {
    try {
      const { error } = await supabase.from('ads').update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
      showAction('Ad rejected');
      fetchAds();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

  const deleteAd = async (id: string) => {
    if (!confirm('Delete this ad permanently?')) return;
    try {
      const { error } = await supabase.from('ads').delete().eq('id', id);
      if (error) throw error;
      showAction('Ad deleted');
      fetchAds();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

  // ── Admin-created ad ──────────────────────────────────────────────────────
  const resetAddAdForm = () => {
    setAdMediaFile(null);
    setAdMediaUrlInput('');
    setAdMediaPreview('');
    setAdClickUrl('');
    setAdAdvertiserEmail('');
    setAdAdvertiserWallet('');
    setAdTier('basic');
    setAdDailyMinutes('5');
    setAdIntervalSeconds('3');
    setAdValidityDays('7');
    setAddAdError('');
    setAdUploadProgress(0);
    setAdMediaMode('upload');
  };

  const handleAdFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
    if (!allowed.includes(file.type)) { setAddAdError('Only JPEG, PNG, GIF, or MP4 files allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { setAddAdError('File must be under 10MB.'); return; }
    setAdMediaFile(file);
    setAddAdError('');
    setAdMediaPreview(URL.createObjectURL(file));
  };

  const handleAdMediaUrlChange = (url: string) => {
    setAdMediaUrlInput(url);
    setAdMediaPreview(url);
  };

  const connectAdminWallet = async () => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) { showAction('❌ No wallet detected. Install MetaMask or use MiniPay.'); return; }
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) { setAdminWallet(accounts[0]); showAction('✅ Wallet connected: ' + accounts[0].slice(0,6) + '...' + accounts[0].slice(-4)); }
    } catch (e: any) { showAction('❌ Wallet connection failed: ' + e.message); }
  };

  const signAdUpload = async (adDetails: string): Promise<string | null> => {
    try {
      const eth = (window as any).ethereum;
      if (!eth || !adminWallet) return null;
      setIsSigning(true);
      setSignatureStatus('signing');
      const message = `Memory Master Admin Ad Upload\n\nAdmin: ${adminWallet}\nTimestamp: ${new Date().toISOString()}\nDetails: ${adDetails}\n\nThis signature authorises the ad upload. No gas fee or payment is charged.`;
      const sig: string = await eth.request({
        method: 'personal_sign',
        params: [message, adminWallet],
      });
      setAdSignature(sig);
      setSignatureStatus('signed');
      return sig;
    } catch (e: any) {
      setSignatureStatus('skipped');
      return null;
    } finally {
      setIsSigning(false);
    }
  };

  const handleSubmitAdminAd = async () => {
    setAddAdError('');
    if (adMediaMode === 'upload' && !adMediaFile) { setAddAdError('Please upload a media file.'); return; }
    if (adMediaMode === 'url' && !adMediaUrlInput) { setAddAdError('Please enter a media URL.'); return; }
    if (!adClickUrl) { setAddAdError('Please enter a destination URL.'); return; }
    if (!adClickUrl.startsWith('http')) { setAddAdError('Destination URL must start with http:// or https://'); return; }

    setIsSubmittingAd(true);
    setAdUploadProgress(10);
    setSignatureStatus('idle');
    setAdSignature(null);

    try {
      let finalMediaUrl = adMediaUrlInput;
      let finalMediaType = 'image/jpeg';

      if (adMediaMode === 'upload' && adMediaFile) {
        const ext = adMediaFile.name.split('.').pop();
        const fileName = `admin_${Date.now()}.${ext}`;
        setAdUploadProgress(30);

        const { error: uploadError } = await supabase.storage
          .from('ad-media')
          .upload(fileName, adMediaFile, { contentType: adMediaFile.type });

        if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

        setAdUploadProgress(60);
        const { data: { publicUrl } } = supabase.storage.from('ad-media').getPublicUrl(fileName);
        finalMediaUrl = publicUrl;
        finalMediaType = adMediaFile.type;
      } else {
        const lower = adMediaUrlInput.toLowerCase();
        if (lower.includes('.mp4') || lower.includes('video')) finalMediaType = 'video/mp4';
        else if (lower.includes('.gif')) finalMediaType = 'image/gif';
        else if (lower.includes('.png')) finalMediaType = 'image/png';
        else finalMediaType = 'image/jpeg';
      }

      setAdUploadProgress(70);

      // Free blockchain signature — no gas, no payment
      const sigDetails = `tier:${adTier} url:${adClickUrl} days:${adValidityDays}`;
      const sig = adminWallet ? await signAdUpload(sigDetails) : null;

      setAdUploadProgress(85);

      const now = new Date();
      const expires = new Date(now);
      expires.setDate(expires.getDate() + parseInt(adValidityDays));

      const { error: dbError } = await supabase.from('ads').insert({
        advertiser_wallet: adAdvertiserWallet || adminWallet || '0x0000000000000000000000000000000000000000',
        advertiser_email: adAdvertiserEmail || null,
        media_url: finalMediaUrl,
        media_type: finalMediaType,
        click_url: adClickUrl,
        tier: adTier,
        usdt_paid: 0,
        daily_minutes: parseInt(adDailyMinutes) || 5,
        interval_seconds: parseInt(adIntervalSeconds) || 3,
        validity_days: parseInt(adValidityDays) || 7,
        tx_hash: sig || null,
        status: 'approved',
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
      });

      if (dbError) throw new Error('Failed to save ad: ' + dbError.message);

      setAdUploadProgress(100);
      showAction(sig ? '✅ Ad created, approved & signed' : '✅ Ad created and approved');
      setShowAddAd(false);
      resetAddAdForm();
      setSignatureStatus('idle');
      setAdSignature(null);
      setAdFilter('approved');
      fetchAds();
    } catch (e: any) {
      setAddAdError(e.message || 'Failed to create ad.');
    } finally {
      setIsSubmittingAd(false);
      setAdUploadProgress(0);
    }
  };

  // ── Consultation actions ───────────────────────────────────────────────────
  const markRead = async (id: string) => {
    try {
      await supabase.from('consultation_requests').update({ status: 'read' }).eq('id', id);
      fetchConsultations();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

  // ── Admin management ──────────────────────────────────────────────────────
  const addAdmin = async () => {
    if (!newAdminUsername || !newAdminPassword) { showAction('❌ Enter username and password'); return; }
    if (newAdminPassword.length < 8) { showAction('❌ Password must be at least 8 characters'); return; }
    setIsAddingAdmin(true);
    try {
      const hashed = await hashPassword(newAdminPassword);
      const { error } = await supabase.from('admins').insert({
        username: newAdminUsername.toLowerCase(),
        password_hash: hashed,
      });
      if (error) { showAction(error.code === '23505' ? '❌ Username already exists' : '❌ ' + error.message); return; }
      showAction('✅ Admin added');
      setNewAdminUsername('');
      setNewAdminPassword('');
      fetchAdmins();
    } catch (e: any) { showAction('❌ ' + e.message); }
    finally { setIsAddingAdmin(false); }
  };

  const deleteAdmin = async (id: string, username: string) => {
    if (username === currentAdmin) { showAction('❌ Cannot delete your own account'); return; }
    if (!confirm(`Delete admin "${username}"?`)) return;
    try {
      const { error } = await supabase.from('admins').delete().eq('id', id);
      if (error) throw error;
      showAction('Admin removed');
      fetchAdmins();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

  const pendingCount = ads.filter(a => a.status === 'pending').length;
  const unreadCount = consultations.filter(c => c.status === 'unread').length;

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Memory Master</p>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="Username" value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            <input type="password" placeholder="Password" value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            {loginError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{loginError}
              </div>
            )}
            <button onClick={handleLogin} disabled={isLoggingIn}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
              {isLoggingIn ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main portal ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm">Admin Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:block">{currentAdmin}</span>
          <button onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">
            ← Game
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-red-400 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg border border-gray-700 whitespace-nowrap">
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4">
        <div className="flex max-w-5xl mx-auto">
          {([
            { key: 'ads', label: 'Ads', icon: Megaphone, badge: pendingCount },
            { key: 'consultations', label: 'Consultations', icon: MessageSquare, badge: unreadCount },
            { key: 'admins', label: 'Admins', icon: Users, badge: 0 },
          ] as const).map(({ key, label, icon: Icon, badge }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              <Icon className="w-4 h-4" />{label}
              {badge > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* ── ADS ── */}
        {activeTab === 'ads' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'pending', 'approved', 'rejected', 'expired'] as const).map(f => (
                  <button key={f} onClick={() => setAdFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      adFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>{f}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchAds} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowAddAd(v => !v); resetAddAdForm(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Ad
                </button>
              </div>
            </div>

            {/* ── Add Ad Form ── */}
            {showAddAd && (
              <div className="bg-gray-900 rounded-2xl border border-indigo-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-400" /> Create New Ad
                  </p>
                  <button onClick={() => { setShowAddAd(false); resetAddAdForm(); }}
                    className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Media mode toggle */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Media</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-700 mb-3">
                    <button
                      onClick={() => { setAdMediaMode('upload'); setAdMediaPreview(''); setAdMediaUrlInput(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all ${adMediaMode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      <Upload className="w-3.5 h-3.5" /> Upload File
                    </button>
                    <button
                      onClick={() => { setAdMediaMode('url'); setAdMediaFile(null); setAdMediaPreview(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all ${adMediaMode === 'url' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      <Link className="w-3.5 h-3.5" /> Paste URL
                    </button>
                  </div>

                  {adMediaMode === 'upload' ? (
                    <div
                      onClick={() => adFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[80px]">
                      <input ref={adFileInputRef} type="file" accept="image/jpeg,image/png,image/gif,video/mp4"
                        onChange={handleAdFileSelect} className="hidden" />
                      {adMediaFile ? (
                        <p className="text-xs text-indigo-400 font-medium">{adMediaFile.name}</p>
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-gray-600 mb-1" />
                          <p className="text-xs text-gray-500">Click to upload JPEG, PNG, GIF or MP4 (max 10MB)</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={adMediaUrlInput}
                      onChange={(e) => handleAdMediaUrlChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                  )}

                  {/* Preview */}
                  {adMediaPreview && (
                    <div className="mt-2 rounded-xl overflow-hidden bg-gray-800 max-h-40 flex items-center justify-center">
                      {(adMediaPreview.includes('.mp4') || adMediaFile?.type === 'video/mp4')
                        ? <video src={adMediaPreview} controls className="max-h-40 w-full object-contain" />
                        : <img src={adMediaPreview} alt="Preview" className="max-h-40 object-contain"
                            onError={() => setAdMediaPreview('')} />
                      }
                    </div>
                  )}
                </div>

                {/* Destination URL */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Destination URL <span className="text-red-400">*</span>
                  </label>
                  <input type="url" placeholder="https://advertiser-site.com"
                    value={adClickUrl} onChange={(e) => setAdClickUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>

                {/* Tier */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Tier</label>
                  <select value={adTier} onChange={(e) => setAdTier(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                    {AD_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>

                {/* Schedule fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Daily Min</label>
                    <input type="number" min="1" placeholder="5"
                      value={adDailyMinutes} onChange={(e) => setAdDailyMinutes(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Interval (s)</label>
                    <input type="number" min="1" placeholder="3"
                      value={adIntervalSeconds} onChange={(e) => setAdIntervalSeconds(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Validity (d)</label>
                    <input type="number" min="1" placeholder="7"
                      value={adValidityDays} onChange={(e) => setAdValidityDays(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                      Advertiser Email <span className="text-gray-600 font-normal normal-case">(optional)</span>
                    </label>
                    <input type="email" placeholder="advertiser@example.com"
                      value={adAdvertiserEmail} onChange={(e) => setAdAdvertiserEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                      Advertiser Wallet <span className="text-gray-600 font-normal normal-case">(optional)</span>
                    </label>
                    <input type="text" placeholder="0x..."
                      value={adAdvertiserWallet} onChange={(e) => setAdAdvertiserWallet(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>

                {/* Progress bar */}
                {isSubmittingAd && adUploadProgress > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${adUploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 text-center">{adUploadProgress}% complete</p>
                  </div>
                )}

                {/* Error */}
                {addAdError && (
                  <div className="flex items-start gap-2 text-red-400 bg-red-900/20 p-3 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{addAdError}
                  </div>
                )}

                {/* Blockchain signing panel */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PenLine className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-white">Free Admin Signature</span>
                      <span className="text-xs text-gray-500">(optional · no gas)</span>
                    </div>
                    {adminWallet ? (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {adminWallet.slice(0,6)}...{adminWallet.slice(-4)}
                      </span>
                    ) : (
                      <button onClick={connectAdminWallet}
                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors">
                        <Wallet className="w-3 h-3" /> Connect Wallet
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Signing proves you authorised this ad upload on-chain. It's completely free — no payment or gas required.
                  </p>
                  {signatureStatus === 'signed' && adSignature && (
                    <div className="flex items-center gap-2 text-green-400 bg-green-900/20 p-2 rounded-lg text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono truncate">{adSignature.slice(0, 30)}…</span>
                      <span className="text-green-500 shrink-0">Signed ✓</span>
                    </div>
                  )}
                  {signatureStatus === 'skipped' && (
                    <p className="text-xs text-amber-400">Signature skipped — ad will be saved without a signature.</p>
                  )}
                  {signatureStatus === 'signing' && (
                    <div className="flex items-center gap-2 text-indigo-400 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for wallet signature…
                    </div>
                  )}
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-2 text-indigo-300 bg-indigo-900/20 p-3 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                  This ad will be immediately <strong className="text-indigo-200">approved</strong> and start running today. Free — no payment required.
                </div>

                <button onClick={handleSubmitAdminAd} disabled={isSubmittingAd || isSigning}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                  {isSubmittingAd
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isSigning ? 'Signing…' : 'Creating Ad…'}</>
                    : <><Plus className="w-4 h-4" />Create & Approve Ad</>}
                </button>
              </div>
            )}

            {/* ── Ad list ── */}
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
            ) : ads.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No ads found</p>
              </div>
            ) : ads.map(ad => (
              <div key={ad.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-14 h-14 bg-gray-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    {ad.media_type.startsWith('video')
                      ? <Video className="w-5 h-5 text-gray-500" />
                      : <img src={ad.media_url} alt="Ad" className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[ad.status]}`}>
                        {ad.status}
                      </span>
                      <span className="text-xs text-gray-500">{ad.tier} · {ad.usdt_paid} USDT</span>
                    </div>
                    <p className="text-sm text-white truncate">{ad.click_url}</p>
                    <p className="text-xs text-gray-500">{formatAddress(ad.advertiser_wallet)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ad.status === 'pending' && <>
                      <button onClick={() => approveAd(ad)} title="Approve"
                        className="w-8 h-8 flex items-center justify-center bg-green-900/40 hover:bg-green-900/70 text-green-400 rounded-lg transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => rejectAd(ad.id)} title="Reject"
                        className="w-8 h-8 flex items-center justify-center bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </>}
                    <button onClick={() => deleteAd(ad.id)} title="Delete"
                      className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpandedAd(expandedAd === ad.id ? null : ad.id)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors">
                      {expandedAd === ad.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedAd === ad.id && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                      {ad.media_type.startsWith('video')
                        ? <video src={ad.media_url} controls className="w-full max-h-48 object-contain" />
                        : <img src={ad.media_url} alt="Creative" className="w-full max-h-48 object-contain" />
                      }
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-gray-800 rounded-xl p-3 space-y-1 text-gray-300">
                        <p className="text-gray-500 mb-1">Schedule</p>
                        <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{ad.daily_minutes} min/day · {ad.interval_seconds}s</p>
                        <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ad.validity_days} days</p>
                        {ad.starts_at && <p>Start: {formatDate(ad.starts_at)}</p>}
                        {ad.expires_at && <p>Expires: {formatDate(ad.expires_at)}</p>}
                      </div>
                      <div className="bg-gray-800 rounded-xl p-3 space-y-1 text-gray-300">
                        <p className="text-gray-500 mb-1">Advertiser</p>
                        <p className="break-all text-xs">{ad.advertiser_wallet}</p>
                        {ad.advertiser_email && <p>{ad.advertiser_email}</p>}
                        {ad.tx_hash && (
                          <a href={`https://celoscan.io/tx/${ad.tx_hash}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                            View TX <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">Submitted: {formatDate(ad.created_at)}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── CONSULTATIONS ── */}
        {activeTab === 'consultations' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{consultations.length} total · {unreadCount} unread</p>
              <button onClick={fetchConsultations} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
            ) : consultations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No consultation requests yet</p>
              </div>
            ) : consultations.map(c => (
              <div key={c.id} className={`bg-gray-900 rounded-2xl border overflow-hidden ${c.status === 'unread' ? 'border-indigo-800' : 'border-gray-800'}`}>
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.status === 'unread' && <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />}
                      <span className="font-semibold text-white text-sm">{c.name}</span>
                      <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-indigo-400">{c.email}</p>
                    <p className="text-xs text-gray-500">{formatAddress(c.wallet_address)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === 'unread' && (
                      <button onClick={() => markRead(c.id)} title="Mark as read"
                        className="w-8 h-8 flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-400 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setExpandedConsult(expandedConsult === c.id ? null : c.id)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors">
                      {expandedConsult === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedConsult === c.id && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    <div className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-2">Message</p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.message}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`mailto:${c.email}?subject=Re: Your Memory Master Consultation&body=Hi ${c.name},%0A%0A`}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" /> Reply via Email
                      </a>
                      {c.tx_hash && (
                        <a href={`https://celoscan.io/tx/${c.tx_hash}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> View TX
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── ADMINS ── */}
        {activeTab === 'admins' && (
          <>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Add New Admin
              </p>
              <div className="space-y-3">
                <input type="text" placeholder="Username" value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <input type="password" placeholder="Password (min 8 characters)" value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <button onClick={addAdmin} disabled={isAddingAdmin}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                  {isAddingAdmin ? <><Loader2 className="w-4 h-4 animate-spin" />Adding...</> : <><Plus className="w-4 h-4" />Add Admin</>}
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            ) : admins.map(admin => (
              <div key={admin.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{admin.username}</span>
                    {admin.username === currentAdmin && (
                      <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Added {formatDate(admin.created_at)}</p>
                </div>
                {admin.username !== currentAdmin && (
                  <button onClick={() => deleteAdmin(admin.id, admin.username)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
