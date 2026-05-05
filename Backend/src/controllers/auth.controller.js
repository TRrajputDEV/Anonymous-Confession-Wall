// GET /api/auth/me  — return logged-in user info from session
const getMe = (req, res) => {
  if (req.user) {
    return res.status(200).json({ user: req.user });
  }
  return res.status(401).json({ user: null });
};

// POST /api/auth/logout  — destroy session and clear cookie
const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    const cookieName = process.env.SESSION_COOKIE_NAME || "sid";

    if (!req.session) {
      res.clearCookie(cookieName, { path: "/" });
      return res.status(200).json({ message: "Logged out successfully." });
    }

    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(cookieName, { path: "/" });
      return res.status(200).json({ message: "Logged out successfully." });
    });
  });
};

export { getMe, logout };