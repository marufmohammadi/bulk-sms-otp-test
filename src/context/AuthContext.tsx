import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserProfile } from '../types.ts';
import { safeFetchJson } from '../utils/api.ts';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  adminToken: string | null;
  setOtpSession: (token: string, user: UserProfile) => void;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (data: { fullName?: string; phone?: string }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  setAdminSession: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Store auth tokens in memory as mandated by security guidelines
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });
          const { ok, data } = await safeFetchJson(res);
          if (ok) {
            setUser(data.user);
          }
        } catch (err) {
          console.error('Failed to sync Firebase user with backend:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setOtpSession = (sessionToken: string, verifiedUser: UserProfile) => {
    setToken(sessionToken);
    setUser(verifiedUser);
  };

  const signInWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    setToken(idToken);
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const { ok, data } = await safeFetchJson(res);
    if (!ok) {
      throw new Error(data.error || 'Failed to authenticate with server.');
    }
    setUser(data.user);
  };

  const updateProfile = async (payload: {
    fullName?: string;
    phone?: string;
  }): Promise<UserProfile> => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const { ok, data } = await safeFetchJson(res);
    if (!ok) {
      throw new Error(data.error || 'Failed to update profile.');
    }
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network error on logout
      }
    }
    if (auth.currentUser) {
      await signOut(auth);
    }
    setToken(null);
    setUser(null);
  };

  const setAdminSession = (newAdminToken: string | null) => {
    setAdminToken(newAdminToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        adminToken,
        setOtpSession,
        signInWithGoogle,
        updateProfile,
        logout,
        setAdminSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
