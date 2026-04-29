// ============================================================
// Online Clearance System — Static (HTML/CSS/JS) Build
// ------------------------------------------------------------
// Toggle MODE between "cloud" and "local".
//   cloud → uses Lovable Cloud (Supabase) for real auth + data
//   local → fully offline, all data stored in localStorage
// ============================================================
window.APP_CONFIG = {
  MODE: "local", // "cloud" | "local"

  // Used only when MODE = "cloud". These are publishable keys, safe in client.
  SUPABASE_URL: "https://txoysqarmvynqqntodxo.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4b3lzcWFybXZ5bnFxbnRvZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODk2ODQsImV4cCI6MjA5Mjk2NTY4NH0.Se2Y_uQwQd5aV8YgxfQN7N_AtC9dXhNw1MmuiEE_VS8",

  // Default departments seeded in local mode
  DEFAULT_DEPARTMENTS: [
    { name: "Library",      description: "Return all borrowed books and clear fines." },
    { name: "Hostel",       description: "Vacate room and settle dues." },
    { name: "Finance",      description: "Settle tuition and miscellaneous fees." },
    { name: "Examination",  description: "Verify exam dues and pending grades." },
    { name: "Sports",       description: "Return equipment and gear." },
    { name: "Lab/Department",description:"Return lab equipment and clear records." },
  ],

  // Mock dues for local mode (per-department)
  DEFAULT_DUES: {
    "Library":       [{ item: "Overdue book fine — 'Algorithms'", amount: 120 }],
    "Hostel":        [{ item: "Mess bill (April)", amount: 2400 }, { item: "Room damage", amount: 500 }],
    "Finance":       [{ item: "Tuition balance", amount: 0 }],
    "Examination":   [],
    "Sports":        [{ item: "Badminton racket — not returned", amount: 800 }],
    "Lab/Department":[{ item: "Glassware breakage", amount: 350 }],
  },
};
