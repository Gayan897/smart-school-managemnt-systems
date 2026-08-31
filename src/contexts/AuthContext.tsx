import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AppLanguage } from '../data/models';
import { databaseService } from '../data/database';

interface AuthContextType {
  user: User | null;
  language: AppLanguage;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  setLanguage: (lang: AppLanguage) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLang] = useState<AppLanguage>(() => {
    const saved = (localStorage.getItem('edunexus_lang') || localStorage.getItem('sams_lang')) as AppLanguage | null;
    return saved || 'english';
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session
    const saved = localStorage.getItem('edunexus_user') || localStorage.getItem('sams_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  async function login(username: string, password: string): Promise<User> {
    let found;
    try {
      found = await databaseService.getUserByUsername(username);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('missing or insufficient')) {
        throw new Error(
          'Firebase permission denied. Please check Firestore security rules in the Firebase Console.'
        );
      }
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('offline')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw new Error(`Firebase error: ${msg}`);
    }
    if (!found) throw new Error('User not found. Please check your username.');
    if (found.password !== password) throw new Error('Incorrect password.');

    // Teacher NIC Verification Check
    if (found.role === 'teacher' && found.nicVerificationStatus === 'pending') {
      const now = Date.now();
      const unlockAt = found.verificationUnlockAt || 0;
      if (unlockAt > now) {
        const diffSec = Math.ceil((unlockAt - now) / 1000);
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        const timeStr = mins > 0 ? `${mins} minute${mins > 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}` : `${secs} second${secs !== 1 ? 's' : ''}`;
        throw new Error(
          `🔒 Account Verification Pending: Your NIC photo match (NIC: ${found.nicNumber || 'Document'}) is verified. Login will be automatically enabled in ${timeStr} (2-minute security period).`
        );
      } else {
        // Unlock time reached, auto-verify
        found.nicVerificationStatus = 'verified';
        await databaseService.updateUserVerificationStatus(found.id, 'verified');
      }
    }

    setUser(found);
    localStorage.setItem('edunexus_user', JSON.stringify(found));
    return found;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('edunexus_user');
    localStorage.removeItem('sams_user');
  }

  function setLanguage(lang: AppLanguage) {
    setLang(lang);
    localStorage.setItem('edunexus_lang', lang);
  }

  return (
    <AuthContext.Provider value={{ user, language, isLoading, login, logout, setLanguage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
