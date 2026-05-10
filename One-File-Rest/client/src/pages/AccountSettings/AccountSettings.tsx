import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input, Badge, Card, CardContent } from '../../components/ui';
import { useSubscription } from '../../hooks/queries/useSubscriptions';
import { getPushStatus, subscribePush, unsubscribePush } from '../../lib/push';
import { useToast } from '../../components/customer/Toast';
import { ArrowLeft, Bell, Shield, User, Globe, LogOut, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccountSettings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: sub } = useSubscription();
  const [pushStatus, setPushStatus] = useState<string>('unknown');

  useEffect(() => {
    getPushStatus().then(setPushStatus);
  }, []);

  const togglePush = async () => {
    if (pushStatus === 'subscribed') {
      await unsubscribePush();
      toast('Notifications disabled', 'info');
      setPushStatus('unsubscribed');
    } else {
      const r = await subscribePush();
      if (r.ok) { toast('Push notifications enabled', 'success'); setPushStatus('subscribed'); }
      else toast('Failed: ' + (r.reason || 'unknown'), 'error');
    }
  };

  const avatarUrl = (user as any)?.avatar_url || (user as any)?.avatar;

  return (
    <div className="page-wrap" style={{ maxWidth: 720 }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ letterSpacing: -0.5 }}>Settings</h1>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center gap-4 pt-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[var(--border)]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-2xl font-bold text-white">
                {(user?.discord_username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{user?.discord_username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="info" size="sm">{user?.role}</Badge>
                <span className="text-xs text-[var(--text-muted)]">Connected via Discord</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[rgba(88,101,242,0.15)] flex items-center justify-center" style={{ color: '#5865F2' }}>
              <Shield size={20} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center gap-3 mb-4 pt-3">
            <Bell size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-base font-bold">Notifications</h3>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              <Smartphone size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div className="text-sm font-semibold">Browser push notifications</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {pushStatus === 'subscribed' && 'Enabled'}
                  {pushStatus === 'unsubscribed' && 'Disabled — tap to enable'}
                  {pushStatus === 'denied' && 'Blocked in browser settings'}
                  {pushStatus === 'unsupported' && 'Not supported in this browser'}
                </div>
              </div>
            </div>
            {(pushStatus !== 'denied' && pushStatus !== 'unsupported') && (
              <Button variant={pushStatus === 'subscribed' ? 'secondary' : 'primary'} size="sm" onClick={togglePush}>
                {pushStatus === 'subscribed' ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center gap-3 mb-4 pt-3">
            <User size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-base font-bold">Account</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--text-secondary)]">Plan</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] capitalize">{user?.plan || 'Free'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--text-secondary)]">Discord ID</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">{user?.discord_id}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--text-secondary)]">Email</span>
              <span className="text-sm text-[var(--text-muted)]">{user?.email || 'Not provided'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription summary */}
      {sub?.planMeta && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-3 mb-4 pt-3">
              <Globe size={18} style={{ color: 'var(--accent)' }} />
              <h3 className="text-base font-bold">Subscription</h3>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--text-secondary)]">{sub.planMeta.name}</span>
              <Badge variant="success" size="sm">${sub.planMeta.price}/mo</Badge>
            </div>
            {sub?.plan_expiry && (
              <div className="flex justify-between items-center py-2 border-t border-[var(--border)]">
                <span className="text-sm text-[var(--text-secondary)]">Renewal</span>
                <span className="text-sm text-[var(--text-primary)]">{new Date(sub.plan_expiry).toLocaleDateString()}</span>
              </div>
            )}
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => navigate('/subscription')}>
              Manage subscription
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <LogOut size={16} style={{ color: 'var(--danger)' }} />
              <span className="text-sm font-semibold text-[var(--danger)]">Sign out</span>
            </div>
            <Button variant="danger" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-[10px] text-[var(--text-muted)] mt-8">
        Elite Tok Club v1.0 · Secured with Discord OAuth
      </p>
    </div>
  );
}