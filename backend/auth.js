// backend/auth.js
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const Person = require("./person");

// ────────────────────────── LocalStrategy (live) ──────────────────────────
// Uses the user's actual DB record and bcrypt hash every time (no dummy hashes)
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !password) {
          return done(null, false, { message: "Email and password are required." });
        }

        // Live DB lookup
        const user = await Person.findOne({ email: normalizedEmail }).exec();
        if (!user) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        // Live bcrypt comparison with stored hash
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        // Optional: gate login if you later add flags (e.g., user.isActive === false)
        // if (user.isSuspended) return done(null, false, { message: "Account suspended." });

        return done(null, user);
      } catch (err) {
        console.error("Passport LocalStrategy error:", err);
        return done(err);
      }
    }
  )
);

// ────────────────────────── Sessions (optional) ──────────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Live DB read for each session load (keeps it real-time if user data changes)
    const user = await Person.findById(id).exec();
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;