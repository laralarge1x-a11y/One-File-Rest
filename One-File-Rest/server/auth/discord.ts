import { Strategy as DiscordStrategy } from 'passport-discord';
import pool from '../db/client.js';

interface DiscordProfile {
  id: string;
  username: string;
  avatar: string | null;
  email: string | null;
}

interface User {
  id: number;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  email: string | null;
  portal_token: string;
  role: 'client' | 'support' | 'case_manager' | 'owner';
}

export const discordStrategy = new DiscordStrategy(
  {
    clientID: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    callbackURL: process.env.DISCORD_REDIRECT_URI!,
    scope: ['identify', 'email'],
  },
  async (accessToken: string, refreshToken: string, profile: DiscordProfile, done: (err: Error | null, user?: User | null) => void) => {
    try {
      const result = await pool.query(
        `INSERT INTO users (discord_id, discord_username, discord_avatar, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (discord_id) DO UPDATE SET
           discord_username = $2,
           discord_avatar = $3,
           email = $4,
           last_active = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [profile.id, profile.username, profile.avatar, profile.email]
      );

      const user = result.rows[0] as User;

      const staffResult = await pool.query(
        'SELECT role FROM staff WHERE discord_id = $1',
        [profile.id]
      );

      const role = staffResult.rows[0]?.role || 'client';

      return done(null, {
        ...user,
        role,
      });
    } catch (err) {
      return done(err instanceof Error ? err : new Error(String(err)));
    }
  }
);
