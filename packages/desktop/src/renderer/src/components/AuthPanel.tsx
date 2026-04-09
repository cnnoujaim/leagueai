import { useAuth } from "../hooks/useAuth";

export function AuthPanel() {
  const { user, isLoading, error, signIn, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="p-4 text-center text-[var(--text-secondary)] text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="text-center">
          <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
            LEAGUEAI
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Sign in to get AI-powered coaching
          </p>
        </div>

        <button
          onClick={signIn}
          className="
            w-full flex items-center justify-center gap-2 px-4 py-2.5
            rounded-md bg-white text-gray-800 font-medium text-sm
            hover:bg-gray-100 transition-colors cursor-pointer
          "
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}
      </div>
    );
  }

  // Signed in — show user info
  return (
    <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--border)]">
      <div className="flex items-center gap-2">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-xs text-[var(--accent)]">
            {user.name[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">
          {user.name}
        </span>
      </div>
      <button
        onClick={signOut}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        Sign out
      </button>
    </div>
  );
}
