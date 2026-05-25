"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";

interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

const SESSION_COOKIE = "__session";

function setSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Strict`;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
}

function setUidCookie(uid: string) {
  document.cookie = `__uid=${uid}; path=/; SameSite=Strict`;
}

function clearUidCookie() {
  document.cookie = `__uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
}

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "userProfile", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      displayName: data.displayName ?? user.displayName ?? "",
      email: data.email ?? user.email ?? "",
      photoURL: data.photoURL ?? user.photoURL ?? "",
    };
  }
  const profile: UserProfile = {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
  };
  await setDoc(ref, {
    uid: user.uid,
    ...profile,
    createdAt: serverTimestamp(),
  });
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u) {
        setSessionCookie();
        setUidCookie(u.uid);
        ensureUserProfile(u)
          .then(setProfile)
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
        clearSessionCookie();
        clearUidCookie();
        router.replace("/login");
      }
    });
    return unsub;
  }, [router]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Cookie + redirect handled by the onAuthStateChanged listener above
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Returns the current user's Firebase ID token, or null if not signed in. */
export async function getIdToken(): Promise<string | null> {
  const { currentUser } = auth;
  if (!currentUser) return null;
  return currentUser.getIdToken();
}
