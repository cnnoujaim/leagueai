import { app, shell } from "electron";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// Simple JSON file store (replaces electron-store to avoid ESM issues)
function getStorePath(): string {
  const dir = join(app.getPath("userData"), "leagueai");
  mkdirSync(dir, { recursive: true });
  return join(dir, "auth.json");
}

function readStore(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(getStorePath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, string>): void {
  writeFileSync(getStorePath(), JSON.stringify(data));
}

const CALLBACK_PORT = 54321;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export async function getStoredSession(): Promise<{
  token: string;
  user: AuthUser;
} | null> {
  const store = readStore();
  const accessToken = store.accessToken;
  const refreshToken = store.refreshToken;

  if (!accessToken || !refreshToken) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    writeStore({});
    return null;
  }

  writeStore({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  const user = data.session.user;
  return {
    token: data.session.access_token,
    user: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.email || "",
      avatar: user.user_metadata?.avatar_url,
    },
  };
}

export async function signInWithGoogle(): Promise<{
  token: string;
  user: AuthUser;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Auth not configured — set SUPABASE_URL and SUPABASE_ANON_KEY");

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "", `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");

        // Supabase PKCE flow sends tokens as a URL fragment (#), which browsers
        // don't send to the server. If no code in query params, serve a small
        // page that extracts the fragment and redirects with query params.
        if (!code) {
          const accessToken = url.searchParams.get("access_token");
          const refreshToken = url.searchParams.get("refresh_token");

          if (accessToken && refreshToken) {
            // Came from fragment-extraction redirect — handle tokens directly
            writeStore({ accessToken, refreshToken });

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="background:#0f0f14;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                  <div style="text-align:center">
                    <h1 style="background:linear-gradient(135deg,#ec4899,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Signed in to LeagueAI</h1>
                    <p>You can close this window and return to the app.</p>
                  </div>
                </body>
              </html>
            `);

            server.close();

            // Fetch user info from Supabase using the access token
            const sb = getSupabase();
            if (sb) {
              const { data: { user } } = await sb.auth.getUser(accessToken);
              if (user) {
                resolve({
                  token: accessToken,
                  user: {
                    id: user.id,
                    email: user.email || "",
                    name: user.user_metadata?.full_name || user.email || "",
                    avatar: user.user_metadata?.avatar_url,
                  },
                });
                return;
              }
            }
            reject(new Error("Failed to get user info"));
            return;
          }

          // No code and no tokens — serve page to extract hash fragment
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="background:#0f0f14;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center">
                  <h1 style="background:linear-gradient(135deg,#ec4899,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Signing in...</h1>
                </div>
                <script>
                  const hash = window.location.hash.substring(1);
                  if (hash) {
                    window.location.href = '/auth/callback?' + hash;
                  } else {
                    const params = new URLSearchParams(window.location.search);
                    if (!params.get('code') && !params.get('access_token')) {
                      document.querySelector('h1').textContent = 'Sign-in failed';
                      document.querySelector('div').innerHTML += '<p>No authentication data received.</p>';
                    }
                  }
                </script>
              </body>
            </html>
          `);
          return;
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session) {
          res.writeHead(400);
          res.end("Authentication failed");
          server.close();
          reject(new Error(error?.message || "Failed to exchange code"));
          return;
        }

        writeStore({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="background:#0f0f14;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
              <div style="text-align:center">
                <h1 style="background:linear-gradient(135deg,#ec4899,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Signed in to LeagueAI</h1>
                <p>You can close this window and return to the app.</p>
              </div>
            </body>
          </html>
        `);

        server.close();

        const user = data.session.user;
        resolve({
          token: data.session.access_token,
          user: {
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.full_name || user.email || "",
            avatar: user.user_metadata?.avatar_url,
          },
        });
      }
    });

    server.listen(CALLBACK_PORT, async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        server.close();
        reject(new Error(error?.message || "Failed to get OAuth URL"));
        return;
      }

      shell.openExternal(data.url);
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Sign-in timed out"));
    }, 120_000);
  });
}

export function signOut(): void {
  writeStore({});
  getSupabase()?.auth.signOut();
}

export function getAccessToken(): string | undefined {
  return readStore().accessToken;
}
