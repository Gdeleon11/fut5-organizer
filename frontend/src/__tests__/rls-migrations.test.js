import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "../supabase/migrations");
const RPCS_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20261119104000_secure_public_rpcs_and_tokens.sql"),
  "utf8",
);
const RLS_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20261119104500_harden_rls_multigroup_and_finance.sql"),
  "utf8",
);
const STORAGE_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20261119105000_harden_storage_buckets.sql"),
  "utf8",
);
const PENDING_FIX_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20261126170000_require_active_membership_rls.sql"),
  "utf8",
);

const ALL_30_TABLES = [
  "profiles", "groups", "group_members", "group_tags", "settings",
  "venues", "matches", "attendances", "guest_players", "recurring_matches",
  "teams", "team_members", "player_ratings", "player_skills", "player_votes",
  "fines", "match_fees", "match_fee_payments", "collections", "collection_payments",
  "group_expenses", "court_reservations", "match_player_stats", "match_stats",
  "tournaments", "tournament_teams", "tournament_team_members",
  "tournament_matches", "tournament_standings", "push_subscriptions",
];

const stripSqlComments = (sql) => sql.replace(/--.*$/gm, "");

describe("Block C — SQL Security Migrations Structural Verification", () => {
  it("wraps all 3 migrations in explicit BEGIN / COMMIT transactions", () => {
    for (const sql of [RPCS_SQL, RLS_SQL, STORAGE_SQL]) {
      const clean = stripSqlComments(sql);
      expect(clean).toMatch(/\bBEGIN;/);
      expect(clean).toMatch(/\bCOMMIT;/);
    }
  });

  it("contains ZERO permissive USING (true) or WITH CHECK (true) policies", () => {
    for (const sql of [RPCS_SQL, RLS_SQL, STORAGE_SQL]) {
      const clean = stripSqlComments(sql);
      expect(clean).not.toMatch(/USING\s*\(\s*true\s*\)/i);
      expect(clean).not.toMatch(/WITH\s+CHECK\s*\(\s*true\s*\)/i);
    }
  });

  it("enables RLS on all 30 public tables and drops legacy policies before recreating", () => {
    expect(RLS_SQL).toContain("DROP POLICY IF EXISTS");
    for (const table of ALL_30_TABLES) {
      expect(RLS_SQL).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("sets explicit search_path = public on every SECURITY DEFINER function", () => {
    for (const sql of [RPCS_SQL, RLS_SQL]) {
      const clean = stripSqlComments(sql);
      const definerMatches = clean.match(/SECURITY DEFINER[\s\S]{0,80}/gi) || [];
      expect(definerMatches.length).toBeGreaterThan(0);
      for (const snippet of definerMatches) {
        expect(snippet).toMatch(/SET search_path\s*=\s*public/i);
      }
    }
  });

  it("revokes PUBLIC execute on all new RPCs and restricts search_groups_public to authenticated", () => {
    expect(RPCS_SQL).toContain("REVOKE ALL ON FUNCTION public.get_public_match_for_guest(text) FROM PUBLIC;");
    expect(RPCS_SQL).toContain("REVOKE ALL ON FUNCTION public.register_guest_for_match(text, text) FROM PUBLIC;");
    expect(RPCS_SQL).toContain("REVOKE ALL ON FUNCTION public.get_public_reservations_by_tokens(text[]) FROM PUBLIC;");
    expect(RPCS_SQL).toContain("REVOKE ALL ON FUNCTION public.submit_reservation_proof_by_token(text, text) FROM PUBLIC;");
    expect(RPCS_SQL).toContain("REVOKE ALL ON FUNCTION public.search_groups_public(text) FROM PUBLIC;");
    expect(RPCS_SQL).toContain("GRANT EXECUTE ON FUNCTION public.search_groups_public(text) TO authenticated;");
    expect(RPCS_SQL).not.toContain("GRANT EXECUTE ON FUNCTION public.search_groups_public(text) TO anon");
  });

  it("protects financial payment columns against self-approval via BEFORE UPDATE triggers", () => {
    expect(RLS_SQL).toContain("CREATE OR REPLACE FUNCTION public.protect_payment_admin_fields()");
    expect(RLS_SQL).toContain("BEFORE UPDATE ON public.match_fee_payments");
    expect(RLS_SQL).toContain("BEFORE UPDATE ON public.collection_payments");
    expect(RLS_SQL).toContain("NEW.status IS DISTINCT FROM OLD.status");
    expect(RLS_SQL).toContain("NEW.proof_status <> 'submitted'");
  });

  it("restricts push_subscriptions admin read to same-group admins only", () => {
    expect(RLS_SQL).toContain("push_subscriptions_select_same_group_admin");
    expect(RLS_SQL).toContain("public.admin_for_profile_group(profile_id)");
  });

  it("hardens payment-proofs bucket to private and scopes match/venue photo uploads to admins", () => {
    expect(STORAGE_SQL).toContain("SET public = false");
    expect(STORAGE_SQL).toContain("WHERE id = 'payment-proofs'");
    expect(STORAGE_SQL).toContain("match_photos_admin_insert");
    expect(STORAGE_SQL).toContain("venue_photos_admin_insert");
    expect(STORAGE_SQL).toContain("reservation_proofs_insert_valid_reservation");
  });
});

describe("Block C — Multi-Group & Anon Access Policy Matrix Simulation", () => {
  // Mirrors the exact predicate logic installed in 20261119104500_harden_rls_multigroup_and_finance.sql
  const memberships = [
    { group_id: "G1", profile_id: "U_A_ADMIN", role: "super_admin", is_active: true },
    { group_id: "G1", profile_id: "U_A_PLAYER", role: "player", is_active: true },
    { group_id: "G2", profile_id: "U_B_ADMIN", role: "admin", is_active: true },
  ];

  const isMember = (uid, gid) =>
    Boolean(uid) && memberships.some((m) => m.profile_id === uid && m.group_id === gid);
  const isAdmin = (uid, gid) =>
    Boolean(uid) &&
    memberships.some(
      (m) => m.profile_id === uid && m.group_id === gid && m.is_active && ["admin", "super_admin"].includes(m.role),
    );
  const canUpdatePayment = (uid, oldRow, newRow) => {
    if (!uid) return false;
    if (isAdmin(uid, oldRow.group_id)) return true;
    if (oldRow.profile_id !== uid || !isMember(uid, oldRow.group_id)) return false;
    if (newRow.status !== oldRow.status) return false;
    if (newRow.proof_status !== oldRow.proof_status && newRow.proof_status !== "submitted") return false;
    return true;
  };
  const canPromoteRole = (uid, gid, targetRole) => {
    if (!isAdmin(uid, gid)) return false;
    const isSuper = memberships.some(
      (m) => m.profile_id === uid && m.group_id === gid && m.is_active && m.role === "super_admin",
    );
    return isSuper || targetRole !== "super_admin";
  };

  it("blocks cross-group reads by UserB_Admin on Group A data", () => {
    expect(isMember("U_B_ADMIN", "G1")).toBe(false);
    expect(isAdmin("U_B_ADMIN", "G1")).toBe(false);
  });

  it("blocks anonymous reads on private group tables", () => {
    expect(isMember(null, "G1")).toBe(false);
    expect(isAdmin(null, "G1")).toBe(false);
  });

  it("blocks player privilege escalation to admin or super_admin", () => {
    expect(canPromoteRole("U_A_PLAYER", "G1", "admin")).toBe(false);
    expect(canPromoteRole("U_A_PLAYER", "G1", "super_admin")).toBe(false);
    expect(canPromoteRole("U_A_ADMIN", "G1", "admin")).toBe(true);
  });

  it("blocks player self-approval on payments while allowing proof upload submission", () => {
    const oldPayment = { group_id: "G1", profile_id: "U_A_PLAYER", status: "pending", proof_status: null };
    expect(
      canUpdatePayment("U_A_PLAYER", oldPayment, { ...oldPayment, status: "paid", proof_status: "approved" }),
    ).toBe(false);
    expect(
      canUpdatePayment("U_A_PLAYER", oldPayment, { ...oldPayment, proof_status: "submitted", proof_url: "proof.jpg" }),
    ).toBe(true);
    expect(
      canUpdatePayment("U_A_ADMIN", oldPayment, { ...oldPayment, status: "paid", proof_status: "approved" }),
    ).toBe(true);
    expect(
      canUpdatePayment("U_B_ADMIN", oldPayment, { ...oldPayment, status: "paid", proof_status: "approved" }),
    ).toBe(false);
  });
});

describe("Pending-Member RLS Privacy Fix (20261126170000_require_active_membership_rls.sql)", () => {
  it("wraps the fix in BEGIN/COMMIT, sets search_path=public, and requires is_active=true", () => {
    const clean = stripSqlComments(PENDING_FIX_SQL);
    expect(clean).toMatch(/\bBEGIN;/);
    expect(clean).toMatch(/\bCOMMIT;/);
    expect(clean).not.toMatch(/USING\s*\(\s*true\s*\)/i);

    const definerMatches = clean.match(/SECURITY DEFINER[\s\S]{0,80}/gi) || [];
    expect(definerMatches.length).toBe(3);
    for (const snippet of definerMatches) {
      expect(snippet).toMatch(/SET search_path\s*=\s*public/i);
    }

    // is_group_member MUST enforce gm.is_active = true
    const igm = clean.match(/CREATE OR REPLACE FUNCTION public\.is_group_member[\s\S]*?\$\$;/i)?.[0] || "";
    expect(igm).toMatch(/gm\.is_active\s*=\s*true/i);

    // shares_group_with MUST enforce gm_self.is_active = true and restrict pending target to admins
    const sgw = clean.match(/CREATE OR REPLACE FUNCTION public\.shares_group_with[\s\S]*?\$\$;/i)?.[0] || "";
    expect(sgw).toMatch(/gm_self\.is_active\s*=\s*true/i);
    expect(sgw).toMatch(/gm_other\.is_active\s*=\s*true/i);
    expect(sgw).toMatch(/gm_self\.role\s+IN\s*\('admin',\s*'super_admin'\)/i);

    // groups_select_member_or_owner uses narrow has_group_membership so pending join flow still works
    expect(clean).toContain("groups_select_member_or_owner");
    expect(clean).toContain("public.has_group_membership(id)");
    expect(clean).toContain("REVOKE ALL ON FUNCTION public.has_group_membership(uuid) FROM PUBLIC;");
  });

  it("blocks pending members from private group reads while preserving own request and admin activation", () => {
    const rows = [
      { group_id: "G1", profile_id: "U_ADMIN", role: "super_admin", is_active: true },
      { group_id: "G1", profile_id: "U_ACTIVE", role: "player", is_active: true },
      { group_id: "G1", profile_id: "U_PENDING", role: "player", is_active: false },
      { group_id: "G2", profile_id: "U_OUTSIDER", role: "player", is_active: true },
    ];

    const hasMembership = (uid, gid) => rows.some((r) => r.profile_id === uid && r.group_id === gid);
    const isActiveMember = (uid, gid) => rows.some((r) => r.profile_id === uid && r.group_id === gid && r.is_active);
    const sharesGroupWith = (uid, targetId) =>
      rows.some(
        (self) =>
          self.profile_id === uid &&
          self.is_active &&
          rows.some(
            (other) =>
              other.group_id === self.group_id &&
              other.profile_id === targetId &&
              (other.is_active || ["admin", "super_admin"].includes(self.role)),
          ),
      );

    // Pending member: sees own request + basic group, ZERO private group tables or other profiles
    expect(hasMembership("U_PENDING", "G1")).toBe(true);
    expect(isActiveMember("U_PENDING", "G1")).toBe(false);
    expect(sharesGroupWith("U_PENDING", "U_ADMIN")).toBe(false);
    expect(sharesGroupWith("U_PENDING", "U_ACTIVE")).toBe(false);

    // Admin: sees group data + pending joiner profile for activation
    expect(isActiveMember("U_ADMIN", "G1")).toBe(true);
    expect(sharesGroupWith("U_ADMIN", "U_PENDING")).toBe(true);

    // Active player: sees active teammates, NOT pending unapproved profile, NOT other group
    expect(isActiveMember("U_ACTIVE", "G1")).toBe(true);
    expect(sharesGroupWith("U_ACTIVE", "U_ADMIN")).toBe(true);
    expect(sharesGroupWith("U_ACTIVE", "U_PENDING")).toBe(false);
    expect(sharesGroupWith("U_ACTIVE", "U_OUTSIDER")).toBe(false);

    // Outsider: 0 access to G1
    expect(hasMembership("U_OUTSIDER", "G1")).toBe(false);
    expect(isActiveMember("U_OUTSIDER", "G1")).toBe(false);
  });
});
