import { Router } from 'express';
import passport from 'passport';
import pool from '../db/client.js';

const router = Router();

router.get('/discord', passport.authenticate('discord'));

router.get(
  '/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

router.get('/access/:token', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE portal_token = $1',
      [req.params.token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const user = result.rows[0];
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      res.redirect('/dashboard');
    });
  } catch (err) {
    res.status(500).json({ error: 'Access failed' });
  }
});

export default router;
