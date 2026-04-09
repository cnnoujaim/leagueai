export const IPC = {
  // Game state events (main → renderer)
  GAME_FLOW_CHANGED: "game:flow-changed",
  CHAMP_SELECT_UPDATE: "game:champ-select-update",

  // Coaching events (main → renderer)
  COACHING_TEXT_CHUNK: "coaching:text-chunk",
  COACHING_DONE: "coaching:done",
  COACHING_ERROR: "coaching:error",
  COACHING_CACHED: "coaching:cached",
  COACHING_UPDATE_CHUNK: "coaching:update-chunk",
  COACHING_UPDATE_DONE: "coaching:update-done",

  // Overlay control (renderer → main)
  SET_IGNORE_MOUSE: "overlay:set-ignore-mouse",
  SHOW_OVERLAY: "overlay:show",
  HIDE_OVERLAY: "overlay:hide",

  // Settings (renderer → main)
  GET_SETTINGS: "settings:get",
  SET_SETTINGS: "settings:set",
} as const;
