const { createClient } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@supabase/supabase-js");
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const U = JSON.parse(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg_users.json", "utf8"));
const admin = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });
(async () => {
  await admin.auth.admin.updateUserById(U.A.id, { user_metadata: { f5_appearance: null } });
  await admin.auth.admin.updateUserById(U.B.id, { user_metadata: { f5_appearance: { design: "command", palette: "midnight", updatedAt: 1000 }, role: null, is_admin: null, is_super_admin: null } });
  console.log("reset ok");
})();
