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
    return (localStorage.getItem('sams_lang') as AppLanguage) || 'english';
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session
    const saved = localStorage.getItem('sams_user');
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
    setUser(found);
    localStorage.setItem('sams_user', JSON.stringify(found));
    return found;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('sams_user');
  }

  function setLanguage(lang: AppLanguage) {
    setLang(lang);
    localStorage.setItem('sams_lang', lang);
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
