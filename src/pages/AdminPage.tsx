import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
  Shield, LogOut, Eye, Check, X, Trash2, Plus, Users,
  MessageSquare, Megaphone, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Calendar, Loader2,
  ChevronDown, ChevronUp, Video
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY  // service role key bypasses RLS
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

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState('');

  const [activeTab, setActiveTab] = useState<Tab>('ads');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [expandedAd, setExpandedAd] = useState<string | null>(null);
  const [expandedConsult, setExpandedConsult] = useState<string | null>(null);

  const [ads, setAds] = useState<Ad[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adFilter, setAdFilter] = useState<AdStatus | 'all'>('pending');

  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_session');
    if (saved) { setCurrentAdmin(saved); setIsAuthenticated(true); }
  }, []);

  // Fix default password hash on first login
  useEffect(() => {
    if (!isAuthenticated) return;
    const fixHash = async () => {
      const hashed = await hashPassword('12345678910');
      await supabase.from('admins')
        .update({ password_hash: hashed })
        .eq('username', 'hawwal')
        .eq('password_hash', '$2a$10$placeholder_will_be_replaced');
    };
    fixHash();
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) { setLoginError('Please enter username and password.'); return; }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      console.log('[DEBUG] Attempting login for:', loginUsername.toLowerCase());
      console.log('[DEBUG] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('[DEBUG] Anon key present:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

      const { data, error } = await supabase
        .from('admins')
        .select('id, username, password_hash')
        .eq('username', loginUsername.toLowerCase())
        .single();

      console.log('[DEBUG] Supabase data:', data);
      console.log('[DEBUG] Supabase error:', error);

      if (error || !data) {
        console.log('[DEBUG] Login failed at data/error check. Error:', error?.message, '| Code:', error?.code);
        setLoginError('Invalid username or password.');
        return;
      }

      const hashedInput = await hashPassword(loginPassword);
      console.log('[DEBUG] Hashed input:  ', hashedInput);
      console.log('[DEBUG] DB hash:       ', data.password_hash);
      console.log('[DEBUG] Hashes match:  ', data.password_hash === hashedInput);

      if (data.password_hash !== hashedInput) {
        console.log('[DEBUG] Login failed at hash comparison.');
        setLoginError('Invalid username or password.');
        return;
      }

      console.log('[DEBUG] Login successful!');
      setCurrentAdmin(data.username);
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_session', data.username);
    } catch (e: any) {
      console.log('[DEBUG] Exception caught:', e);
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

  const markRead = async (id: string) => {
    try {
      await supabase.from('consultation_requests').update({ status: 'read' }).eq('id', id);
      fetchConsultations();
    } catch (e: any) { showAction('❌ ' + e.message); }
  };

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
              <button onClick={fetchAds} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

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
