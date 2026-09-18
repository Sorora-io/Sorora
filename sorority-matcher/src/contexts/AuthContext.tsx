import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ session: Session | null; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let previousId: string | null = null;
    const applySession = (next: Session | null) => {
      if (!active) return;
      const nextId = next?.user.id ?? null;
      if (previousId !== nextId) queryClient.clear();
      previousId = nextId;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      applySession(next);
    });
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!authEventReceived) applySession(initial);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { session: data.session, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    queryClient.clear();
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, loading,
        signUp, signIn, signOut, updatePassword, sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
