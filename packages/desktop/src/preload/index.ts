import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("leagueAI", {
  // Receive coaching events
  onCoachingChunk: (callback: (text: string) => void) => {
    ipcRenderer.on("coaching:text-chunk", (_, text) => callback(text));
  },
  onCoachingDone: (callback: () => void) => {
    ipcRenderer.on("coaching:done", () => callback());
  },
  onCoachingCached: (callback: (text: string) => void) => {
    ipcRenderer.on("coaching:cached", (_, text) => callback(text));
  },
  onCoachingError: (callback: (error: string) => void) => {
    ipcRenderer.on("coaching:error", (_, error) => callback(error));
  },
  onCoachingUpdateChunk: (callback: (text: string) => void) => {
    ipcRenderer.on("coaching:update-chunk", (_, text) => callback(text));
  },
  onCoachingUpdateDone: (callback: () => void) => {
    ipcRenderer.on("coaching:update-done", () => callback());
  },

  // Receive game flow events
  onGameFlowChanged: (callback: (phase: string) => void) => {
    ipcRenderer.on("game:flow-changed", (_, phase) => callback(phase));
  },

  // Overlay control
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send("overlay:set-ignore-mouse", ignore);
  },
  showOverlay: () => ipcRenderer.send("overlay:show"),
  hideOverlay: () => ipcRenderer.send("overlay:hide"),

  // Auth
  signInWithGoogle: () => ipcRenderer.invoke("auth:sign-in-google"),
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
  getUser: () => ipcRenderer.invoke("auth:get-user"),
  onAuthChanged: (callback: (user: unknown) => void) => {
    ipcRenderer.on("auth:changed", (_, user) => callback(user));
  },
});
