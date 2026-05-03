import { Strategy as DiscordStrategy } from 'passport-discord';
import pool from '../db/client.js';

interface DiscordProfile {
  id: string;
  username: string;
  avatar: string | null;
  email: string | null;
  discriminator?: string;
  global_name?: string | null;
}

const clientID = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const callbackURL = process.env.DISCORD_REDIRECT_URI;

if (!clientID || !clientSecret || !callbackURL) {
  console.warn('⚠️  Discord OAuth credentials not configured:');
  if (!clientID) console.warn('   - DISCORD_CLIENT_ID is missing');
  if (!clientSecret) console.warn('   - DISCORD_CLIENT_SECRET is missing');
  if (!callbackURL) console.warn('   - DISCORD_REDIRECT_URI is missing');
} else {
  console.log('[Discord OAuth] Configured with redirect URI:', callbackURL);
}

function buildDiscordStrategy(): DiscordStrategy | null {
  if (!clientID || !clientSecret || !callbackURL) return null;
  const opts = {
    clientID,
    clientSecret,
    callbackURL,
    scope: ['identify', 'email'],
  };
  const verify = async (
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordProfile,
    done: (err: Error | null, user?: Express.User) => void
  ): Promise<void> => {
        try {
          console.log('[Discord Strategy] Received profile:', {
            id: profile.id,
            username: profile.username,
            email: profile.email ? '(set)' : '(not set)',
            hasAvatar: !!profile.avatar,
          });

          // Upsert user into database
          const displayName = profile.global_name || profile.username;

          const result = await pool.query(
            `INSERT INTO users (discord_id, discord_username, discord_avatar, email, last_active, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (discord_id) DO UPDATE SET
               discord_username = EXCLUDED.discord_username,
               discord_avatar = EXCLUDED.discord_avatar,
               email = COALESCE(EXCLUDED.email, users.email),
               last_active = NOW(),
               updated_at = NOW()
             RETURNING *`,
            [profile.id, displayName, profile.avatar, profile.email]
          );

          const user = result.rows[0];
          console.log('[Discord Strategy] User upserted in DB:', {
            db_id: user.id,
            discord_id: user.discord_id,
            username: user.discord_username,
          });

          // Check if user is staff and get their role
          const staffResult = await pool.query(
            'SELECT role FROM staff WHERE discord_id = $1 AND active = true',
            [profile.id]
          );

          const role = staffResult.rows[0]?.role || 'client';
          console.log('[Discord Strategy] User role resolved:', role);

          return done(null, { ...user, role });
        } catch (err) {
          console.error('[Discord Strategy] Database error during OAuth:', err);
          return done(err instanceof Error ? err : new Error(String(err)));
        }
  };
  type Opts = typeof opts;
  type Verify = (
    accessToken: string,
    refreshToken: string,
    profile: DiscordProfile,
    done: (err: Error | null, user?: Express.User) => void,
  ) => Promise<void>;
  // @types/passport-discord's 4-arg overload incorrectly requires
  // passReqToCallback:true; the runtime accepts the simpler form.
  const Ctor = DiscordStrategy as unknown as new (o: Opts, v: Verify) => DiscordStrategy;
  return new Ctor(opts, verify);
}

export const discordStrategy = buildDiscordStrategy();
