import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarHeart, Home, Users, CreditCard, Shield, Trophy, UserCircle, BookOpen } from "lucide-react";
import { api } from "./api.js";
import Avatar from "./components/Avatar.jsx";
import PushNotifications from "./components/PushNotifications.jsx";
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
import SectionHero from "./components/SectionHero.jsx";
import AdBanner from "./components/AdBanner.jsx";
import PostMatchSurveyModal from "./components/PostMatchSurveyModal.jsx";
import AuthScreen from "./pages/AuthScreen.jsx";
import GroupOnboardingPage from "./pages/GroupOnboardingPage.jsx";
import GroupsPage from "./pages/GroupsPage.jsx";
import MatchDetail from "./pages/MatchDetail.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import ProofUploadPage from "./pages/ProofUploadPage.jsx";
import GuestRegisterPage from "./pages/GuestRegisterPage.jsx";
import CourtReservationPage from "./pages/CourtReservationPage.jsx";
import ReservePage from "./pages/ReservePage.jsx";
import SimPage from "./pages/SimPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import TournamentPage from "./pages/TournamentPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import CashierPage from "./pages/CashierPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import MyFifaCardPage from "./pages/MyFifaCardPage.jsx";
import ProfileForm from "./pages/ProfileForm.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import { PrivacyPage, TermsPage, ContactPage } from "./pages/LegalPages.jsx";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";
import { activeReservationStatus, canUseReservationAssistant } from "./reservationAssistant.js";
import { canAccessMatch, collectGroupTags } from "./tags.js";
import { classNames, displayName, formatMatchDate, profileComplete, roleLabel } from "./utils.js";

function ConfigMissing() {
  return (
    <ShellMessage
      title="Conectá Supabase"
      message="Agregá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, luego reiniciá Vite."
    />
  );
}

function ShellMessage({ title, message }) {
  return (
    <div className="app auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">f5manager</p>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
      </section>
    </div>
  );
}

const PAGE_PATHS = {
  matches: "/partidos",
  team: "/equipo",
  leaderboard: "/estadisticas",
  cashier: "/cobros-caja",
  profile: "/perfil",
  groups: "/grupos",
  reservations: "/reservas",
  players: "/jugadores",
  tournaments: "/torneos",
  landing: "/",
  blog: "/blog",
  privacy: "/privacidad",
  terms: "/terminos",
  contact: "/contacto",
  auth: "/login",
};

const PATH_PAGES = Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));

function routeFromLocation() {
  if (typeof window === "undefined") return { page: "matches", matchId: null };

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const matchPath = path.match(/^\/partidos\/([^/]+)$/);
  if (matchPath) {
    return { page: "match", matchId: decodeURIComponent(matchPath[1]) };
  }

  const legacyMappings = {
    "/multas": "cashier",
    "/cobros": "cashier",
    "/finanzas": "cashier",
    "/canchas": "reservations",
    "/simular": "matches",
    "/super-admin": "players",
    "/admin": "matches",
    "/login": "auth",
  };

  if (legacyMappings[path]) {
    return { page: legacyMappings[path], matchId: null };
  }

  return { page: PATH_PAGES[path] || "matches", matchId: null };
}

function urlForPage(page, matchId, groupId) {
  const path = page === "match" && matchId
    ? `/partidos/${encodeURIComponent(matchId)}`
    : PAGE_PATHS[page] || PAGE_PATHS.matches;
  const params = new URLSearchParams();
  if (groupId) params.set("group", groupId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export default function App() {
  const initialRoute = routeFromLocation();
  const [sessionReady, setSessionReady] = useState(!hasSupabaseConfig);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [page, setPage] = useState(initialRoute.page);
  const [selectedMatchId, setSelectedMatchId] = useState(initialRoute.matchId);
  const [matches, setMatches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [teamsByMatch, setTeamsByMatch] = useState({});
  const [fines, setFines] = useState([]);
  const [votes, setVotes] = useState([]);
  const [skills, setSkills] = useState([]);
  const [groupTagRows, setGroupTagRows] = useState([]);
  const [guests, setGuests] = useState({});
  const [settings, setSettings] = useState(null);
  const [venues, setVenues] = useState([]);
  const [matchFees, setMatchFees] = useState([]);
  const [collections, setCollections] = useState([]);
  const [matchStats, setMatchStats] = useState([]);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [simHasGeneratedTeams, setSimHasGeneratedTeams] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // When clicking outside the profile menu, close it
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClick = (e) => {
      if (!e.target.closest('.user-profile-dropdown-container')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfileMenu]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mobileNavRefs = useRef({});

  const [devRoleOverride, setDevRoleOverride] = useState("");

  function loadMockData() {
    const mockProfiles = [
      { id: "e62c1146-24be-47a3-83f1-778848d7d001", full_name: "Guille de León", nickname: "Guille", preferred_position: "Forward", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: ["residente", "veterano"] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d002", full_name: "Ale", nickname: "Ale", preferred_position: "Midfielder", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: ["residente"] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d003", full_name: "Javi B", nickname: "Javi B", preferred_position: "Defender", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: ["veterano"] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d004", full_name: "Darwin", nickname: "Darwin", preferred_position: "Defender", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: [] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d005", full_name: "Ariel", nickname: "Ariel", preferred_position: "Midfielder", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: [] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d006", full_name: "Quex", nickname: "Quex", preferred_position: "Goalkeeper", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: [] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d007", full_name: "Solis", nickname: "Solis", preferred_position: "Midfielder", phone: "5555-5555", avatar_url: null, membership_is_active: true, group_tags: [] },
    ];

    setProfiles(mockProfiles);
    setProfile(mockProfiles[0]); // Guille
    setMemberships([
      { group_id: "e62c1146-24be-47a3-83f1-778848d7d010", role: "super_admin", is_active: true, groups: { id: "e62c1146-24be-47a3-83f1-778848d7d010", name: "Mi chamusca (Local Demo)" } }
    ]);
    setActiveGroupId("e62c1146-24be-47a3-83f1-778848d7d010");
    setGroupTagRows([
      { id: "t1", name: "residente" },
      { id: "t2", name: "veterano" }
    ]);

    const mockMatches = [
      { id: "e62c1146-24be-47a3-83f1-778848d7d101", title: "Plaza 1 - Sintética", match_date: new Date().toISOString().split("T")[0], start_time: "19:00", venue: "Plaza 1 - Sintética", venue_id: "e62c1146-24be-47a3-83f1-778848d7d201", max_players: 15, status: "upcoming", allowed_tags: ["residente"] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d102", title: "Plaza 3 - Domo Pro", match_date: new Date(Date.now() + 3*24*60*60*1000).toISOString().split("T")[0], start_time: "20:00", venue: "Plaza 3 - Domo Pro", venue_id: "e62c1146-24be-47a3-83f1-778848d7d202", max_players: 18, status: "upcoming", allowed_tags: ["veterano"] },
      { id: "e62c1146-24be-47a3-83f1-778848d7d103", title: "Plaza 1 - Sintética", match_date: new Date(Date.now() - 4*24*60*60*1000).toISOString().split("T")[0], start_time: "19:00", venue: "Plaza 1 - Sintética", venue_id: "e62c1146-24be-47a3-83f1-778848d7d201", max_players: 15, status: "closed" }
    ];
    setMatches(mockMatches);

    const mockAttendances = [];
    mockProfiles.slice(0, 11).forEach((p, idx) => {
      mockAttendances.push({ id: `e62c1146-24be-47a3-83f1-778848d70${idx}1`, match_id: "e62c1146-24be-47a3-83f1-778848d7d101", profile_id: p.id, status: "confirmed", checked_in: true });
    });
    mockProfiles.slice(0, 3).forEach((p, idx) => {
      mockAttendances.push({ id: `e62c1146-24be-47a3-83f1-778848d70${idx}2`, match_id: "e62c1146-24be-47a3-83f1-778848d7d102", profile_id: p.id, status: "confirmed", checked_in: false });
    });
    setAttendances(mockAttendances);

    setVenues([
      { id: "e62c1146-24be-47a3-83f1-778848d7d201", name: "Plaza 1 - Sintética", address: "Plaza San Ángel, Calzada Roosevelt Km 14, Guatemala", default_cost: 150, notes: "Techada, sintética", lat: 14.6284, lng: -90.5843 },
      { id: "e62c1146-24be-47a3-83f1-778848d7d202", name: "Plaza 3 - Domo Pro", address: "Plaza San Ángel, Calzada Roosevelt Km 14, Guatemala", default_cost: 175, notes: "Domo cerrado", lat: 14.6284, lng: -90.5843 }
    ]);

    setReservations([
      {
        id: "res-mock-1",
        group_id: "e62c1146-24be-47a3-83f1-778848d7d010",
        venue: "Plaza 1 - Sintética",
        reservation_date: new Date(Date.now() + 5*24*60*60*1000).toISOString().split("T")[0],
        reservation_time: "19:00",
        assigned_to: "e62c1146-24be-47a3-83f1-778848d7d001", // Guille
        status: "pending",
        notes: "[Tags: residente] Partido de fin de semana para residentes",
        proof_url: null,
        created_at: new Date().toISOString()
      },
      {
        id: "res-mock-2",
        group_id: "e62c1146-24be-47a3-83f1-778848d7d010",
        venue: "Plaza 3 - Domo Pro",
        reservation_date: new Date(Date.now() + 6*24*60*60*1000).toISOString().split("T")[0],
        reservation_time: "20:00",
        assigned_to: "e62c1146-24be-47a3-83f1-778848d7d002", // Ale
        status: "pending",
        notes: "Partido libre para el grupo completo",
        proof_url: null,
        created_at: new Date().toISOString()
      }
    ]);

    // ---- Datos dummy adicionales para que el demo sea 100% funcional ----
    const pid = (n) => `e62c1146-24be-47a3-83f1-778848d7d00${n}`;
    const GROUP = "e62c1146-24be-47a3-83f1-778848d7d010";
    const CLOSED_MATCH = "e62c1146-24be-47a3-83f1-778848d7d103";
    const NEXT_MATCH = "e62c1146-24be-47a3-83f1-778848d7d101";
    const receiptDemo =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='420'><rect width='100%' height='100%' fill='#143d1a'/><text x='50%' y='45%' fill='#39e55a' font-size='26' font-family='sans-serif' text-anchor='middle'>Recibo Demo</text><text x='50%' y='58%' fill='#8eb896' font-size='16' font-family='sans-serif' text-anchor='middle'>Transferencia Q150.00</text></svg>",
      );

    // Ratings por posición (escala 1-5)
    const ratingDefs = {
      1: { attack_rating: 5, midfield_rating: 3, defense_rating: 2, goalkeeper_rating: 1 },
      2: { attack_rating: 3, midfield_rating: 5, defense_rating: 3, goalkeeper_rating: 1 },
      3: { attack_rating: 2, midfield_rating: 3, defense_rating: 5, goalkeeper_rating: 2 },
      4: { attack_rating: 2, midfield_rating: 3, defense_rating: 4, goalkeeper_rating: 1 },
      5: { attack_rating: 4, midfield_rating: 4, defense_rating: 2, goalkeeper_rating: 1 },
      6: { attack_rating: 1, midfield_rating: 2, defense_rating: 3, goalkeeper_rating: 5 },
      7: { attack_rating: 3, midfield_rating: 4, defense_rating: 3, goalkeeper_rating: 1 },
    };
    setRatings(
      Object.entries(ratingDefs).map(([n, r]) => {
        const avg = Math.round(
          (r.attack_rating + r.midfield_rating + r.defense_rating + r.goalkeeper_rating) / 4,
        );
        return {
          id: `rating-mock-${n}`,
          group_id: GROUP,
          profile_id: pid(n),
          rating: avg,
          ...r,
          assigned_by: pid(1),
          created_at: new Date().toISOString(),
        };
      }),
    );

    // Habilidades especiales
    setSkills([
      { id: "skill-m1", group_id: GROUP, player_id: pid(1), skill: "cannon" },
      { id: "skill-m2", group_id: GROUP, player_id: pid(1), skill: "speedy" },
      { id: "skill-m3", group_id: GROUP, player_id: pid(2), skill: "tactician" },
      { id: "skill-m4", group_id: GROUP, player_id: pid(3), skill: "shield" },
      { id: "skill-m5", group_id: GROUP, player_id: pid(5), skill: "wings" },
      { id: "skill-m6", group_id: GROUP, player_id: pid(6), skill: "goalkeeper" },
    ]);

    // Estadísticas del partido cerrado
    setMatchStats([
      { id: "stat-m1", match_id: CLOSED_MATCH, player_id: pid(1), goals: 2, assists: 1, mvp: true, clean_sheet: false },
      { id: "stat-m2", match_id: CLOSED_MATCH, player_id: pid(2), goals: 0, assists: 2, mvp: false, clean_sheet: false },
      { id: "stat-m3", match_id: CLOSED_MATCH, player_id: pid(3), goals: 0, assists: 0, mvp: false, clean_sheet: true },
      { id: "stat-m4", match_id: CLOSED_MATCH, player_id: pid(5), goals: 1, assists: 0, mvp: false, clean_sheet: false },
      { id: "stat-m5", match_id: CLOSED_MATCH, player_id: pid(6), goals: 0, assists: 0, mvp: false, clean_sheet: true },
    ]);

    // Ajustes del grupo
    setSettings({ id: "settings-mock", group_id: GROUP, late_cancel_fine_amount: 25 });

    // Cuota de cancha (con comprobantes por validar para probar botones admin)
    setMatchFees([
      {
        id: "fee-mock-1",
        match_id: CLOSED_MATCH,
        group_id: GROUP,
        total_amount: 150,
        per_player_amount: 30,
        due_before: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: "open",
        match_fee_payments: [
          { id: "mfp-1", match_fee_id: "fee-mock-1", group_id: GROUP, profile_id: pid(1), status: "paid", proof_status: "approved", proof_url: receiptDemo },
          { id: "mfp-2", match_fee_id: "fee-mock-1", group_id: GROUP, profile_id: pid(2), status: "pending", proof_status: "submitted", proof_url: receiptDemo },
          { id: "mfp-3", match_fee_id: "fee-mock-1", group_id: GROUP, profile_id: pid(3), status: "pending", proof_status: "submitted", proof_url: receiptDemo },
          { id: "mfp-4", match_fee_id: "fee-mock-1", group_id: GROUP, profile_id: pid(4), status: "forgiven", proof_status: null, proof_url: null },
          { id: "mfp-5", match_fee_id: "fee-mock-1", group_id: GROUP, profile_id: pid(5), status: "pending", proof_status: null, proof_url: null },
        ],
      },
    ]);

    // Cobro grupal
    setCollections([
      {
        id: "col-mock-1",
        group_id: GROUP,
        title: "Uniformes nuevos",
        amount_per_player: 50,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "open",
        collection_payments: [
          { id: "cp-1", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(1), status: "paid", proof_status: "approved", proof_url: receiptDemo },
          { id: "cp-2", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(2), status: "pending", proof_status: "submitted", proof_url: receiptDemo },
          { id: "cp-3", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(3), status: "pending", proof_status: null, proof_url: null },
          { id: "cp-4", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(4), status: "pending", proof_status: null, proof_url: null },
          { id: "cp-5", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(5), status: "pending", proof_status: null, proof_url: null },
          { id: "cp-6", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(6), status: "pending", proof_status: null, proof_url: null },
          { id: "cp-7", collection_id: "col-mock-1", group_id: GROUP, profile_id: pid(7), status: "pending", proof_status: null, proof_url: null },
        ],
      },
    ]);

    // Equipos ya generados para el próximo partido
    const teamA = [pid(1), pid(3), pid(5), pid(7)];
    const teamB = [pid(2), pid(4), pid(6)];
    const byId = Object.fromEntries(mockProfiles.map((p) => [p.id, p]));
    setTeamsByMatch({
      [NEXT_MATCH]: [
        { id: "team-mock-a", name: "Equipo Verde", color: "var(--accent)", team_members: teamA.map((id) => ({ profile_id: id, profiles: byId[id] })) },
        { id: "team-mock-b", name: "Equipo Azul", color: "#3b82f6", team_members: teamB.map((id) => ({ profile_id: id, profiles: byId[id] })) },
      ],
    });

    // Gastos de tesorería de ejemplo
    setGroupExpenses([
      { id: "exp-1", group_id: GROUP, concept: "Balones nuevos", amount: 200, created_at: new Date().toISOString() },
      { id: "exp-2", group_id: GROUP, concept: "Petos / chalecos", amount: 120, created_at: new Date().toISOString() },
    ]);
  }

  const activeMembership =
    memberships.find((m) => m.group_id === activeGroupId) || memberships[0] || null;
  const activeGroup = activeMembership?.groups || null;
  const myRole = devRoleOverride || activeMembership?.role || "player";
  const isSuperAdmin = myRole === "super_admin";
  const isAdmin = myRole === "admin" || isSuperAdmin;
  const isActiveMember = Boolean(activeMembership?.is_active);
  const currentGroupProfile = profile
    ? (profiles || []).find((p) => p && p.id === profile.id) || profile
    : profile;
  const currentPlayer = currentGroupProfile ? { ...currentGroupProfile, is_active: isActiveMember } : currentGroupProfile;
  const groupTags = useMemo(
    () => collectGroupTags([...(profiles || []), { group_tags: (groupTagRows || []).map((tag) => tag && tag.name) }]),
    [profiles, groupTagRows],
  );
  const ratingMap = useMemo(() => api.latestRatingsByProfile(ratings), [ratings]);
  const lateCancelFineAmount = settings?.late_cancel_fine_amount ?? 25;

  const voteScoreMap = useMemo(() => {
    const map = new Map();
    (votes || []).forEach((v) => {
      if (v && !map.has(v.voted_id)) map.set(v.voted_id, { total: 0, count: 0 });
      const entry = map.get(v?.voted_id);
      if (entry && v) {
        entry.total += v.vote || 0;
        entry.count += 1;
      }
    });
    const result = new Map();
    map.forEach((val, key) => {
      result.set(key, { average: val.total / val.count, count: val.count });
    });
    return result;
  }, [votes]);

  const userVoteMap = useMemo(() => {
    const map = new Map();
    if (!profile) return map;
    votes.filter((v) => v.voter_id === profile.id).forEach((v) => {
      map.set(v.voted_id, v.vote);
    });
    return map;
  }, [votes, profile]);

  async function votePlayer(votedId, vote) {
    if (!profile || votedId === profile.id) return;
    try {
      const existing = userVoteMap.get(votedId);
      if (isDemoMode) {
        if (existing === vote) {
          setVotes((c) => c.filter((v) => !(v.voter_id === profile.id && v.voted_id === votedId)));
        } else {
          setVotes((c) => [
            ...c.filter((v) => !(v.voter_id === profile.id && v.voted_id === votedId)),
            { id: `vote-demo-${votedId}-${Date.now()}`, voter_id: profile.id, voted_id: votedId, vote },
          ]);
        }
        return;
      }
      if (existing === vote) {
        await api.removeVote(activeGroupId, profile.id, votedId);
        setVotes((c) => c.filter((v) => !(v.voter_id === profile.id && v.voted_id === votedId)));
      } else {
        const row = await api.votePlayer(activeGroupId, profile.id, votedId, vote);
        setVotes((c) => [
          ...c.filter((v) => !(v.voter_id === profile.id && v.voted_id === votedId)),
          row,
        ]);
      }
    } catch (err) { setError(err.message); }
  }

  const navItems = useMemo(() => [
    { id: "matches", label: "Partidos", mobileLabel: "Partidos", icon: <Home size={20} /> },
    { id: "reservations", label: "Reservas", mobileLabel: "Reservas", icon: <CalendarDays size={20} /> },
    { id: "cashier", label: "Cobros & Caja", mobileLabel: "Cobros", icon: <CreditCard size={20} /> },
    { id: "players", label: "Jugadores", mobileLabel: "Jugad.", icon: <Users size={20} /> },
    { id: "profile", label: "Mi FIFA Card", mobileLabel: "Mi FIFA", icon: <UserCircle size={20} /> },
    ...(isSuperAdmin ? [
      { id: "tournaments", label: "Torneos", mobileLabel: "Torneos", icon: <Trophy size={20} /> },
    ] : []),
  ], [isSuperAdmin]);

  const sortedMatches = useMemo(
    () => [...matches]
      .filter((match) => canAccessMatch(match, currentPlayer, isAdmin))
      .sort((a, b) =>
        `${a.match_date} ${a.start_time}`.localeCompare(`${b.match_date} ${b.start_time}`)
      ), [matches, currentPlayer, isAdmin]
  );
  
  // Modal encuestas post partido
  const pendingSurveyMatch = useMemo(() => {
    if (!profile) return null;
    const now = new Date();
    // Find closed matches that the user attended
    const surveyMatches = matches.filter(m => {
      if (m.status !== "closed" && new Date(`${m.match_date}T${m.start_time || "19:00"}`) >= now) return false;
      const attended = attendances.some(a => a.match_id === m.id && a.profile_id === profile.id && ["confirmed", "checked_in"].includes(a.status));
      if (!attended) return false;
      const hasStats = matchStats.some(s => s.match_id === m.id && s.player_id === profile.id);
      if (hasStats) return false;
      if (localStorage.getItem(`skipped_survey_${m.id}`)) return false;
      return true;
    });
    
    // Pick the most recent one
    return surveyMatches.sort((a, b) => new Date(`${b.match_date}T${b.start_time || "19:00"}`) - new Date(`${a.match_date}T${a.start_time || "19:00"}`))[0] || null;
  }, [matches, attendances, matchStats, profile]);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  
  // Show modal automatically if pendingSurveyMatch changes to a non-null value
  useEffect(() => {
    if (pendingSurveyMatch) {
      setShowSurveyModal(true);
    }
  }, [pendingSurveyMatch]);

  const upcomingMatches = useMemo(
    () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return sortedMatches.filter((m) => {
        if (m.status === "closed" || m.status === "canceled") return false;
        if (m.match_date && m.match_date < today) return false;
        return true;
      });
    },
    [sortedMatches],
  );
  const pastMatches = useMemo(
    () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return sortedMatches.filter((m) => {
        if (m.status === "closed" || m.status === "canceled") return true;
        if (m.match_date && m.match_date < today) return true;
        return false;
      }).reverse();
    },
    [sortedMatches],
  );
  const nextMatch = upcomingMatches[0] || null;
  const selectedMatch = sortedMatches.find((m) => m.id === selectedMatchId) || nextMatch;
  const myGeneratedTeamsCount = useMemo(
    () => (sortedMatches || []).reduce((count, match) => {
      const assignedTeam = ((teamsByMatch || {})[match.id] || []).some((team) =>
        (team?.team_members || []).some((member) => member?.profile_id === currentPlayer?.id),
      );
      return assignedTeam ? count + 1 : count;
    }, 0),
    [currentPlayer?.id, sortedMatches, teamsByMatch],
  );
  const profileById = useMemo(
    () => new Map((profiles || []).filter((p) => p && p.id).map((p) => [p.id, p])), [profiles]
  );
  const matchGuests = guests?.[selectedMatch?.id] || [];
  const myPendingAssistedReservations = useMemo(
    () => matches.filter((match) =>
      match.reservation_owner_user_id === profile?.id
      && activeReservationStatus(match) === "pending"
      && canAccessMatch(match, currentPlayer, isAdmin)
    ),
    [matches, profile?.id, currentPlayer, isAdmin],
  );
  const clearance = useMemo(() => {
    if (!currentPlayer?.id) return { clear: true, total: 0, items: [] };
    const items = [];
    (fines || [])
      .filter((fine) => fine.profile_id === currentPlayer.id && fine.status === "open")
      .forEach((fine) => items.push({ type: "Multa", amount: Number(fine.amount || 0) }));
    (matchFees || []).forEach((fee) => {
      (fee.match_fee_payments || [])
        .filter((payment) => payment.profile_id === currentPlayer.id && payment.status === "pending")
        .forEach(() => items.push({ type: "Cancha", amount: Number(fee.per_player_amount || 0) }));
    });
    (collections || []).forEach((collection) => {
      (collection.collection_payments || [])
        .filter((payment) => payment.profile_id === currentPlayer.id && payment.status === "pending")
        .forEach(() => items.push({ type: "Colaboración", amount: Number(collection.amount_per_player || 0) }));
    });
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return { clear: items.length === 0, total, items };
  }, [collections, currentPlayer?.id, fines, matchFees]);

  useEffect(() => {
    if (selectedMatch?.id && !guests?.[selectedMatch.id]) {
      loadGuests(selectedMatch.id);
    }
  }, [selectedMatch?.id, guests]);

  useEffect(() => {
    if (page !== "sim") setSimHasGeneratedTeams(false);
  }, [page]);

  // Auth
  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) resetState();
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session?.user) {
      bootstrap(session.user);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!navItems.some((i) => i.id === page) && page !== "match") setPage("matches");
  }, [navItems, page]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handlePopState() {
      const route = routeFromLocation();
      setPage(route.page);
      setSelectedMatchId(route.matchId);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (["/proof", "/guest", "/reserve"].some((prefix) => window.location.pathname.startsWith(prefix))) return;

    const currentParams = new URLSearchParams(window.location.search);
    if ((currentParams.has("group") && !activeGroupId) || (currentParams.has("match") && !selectedMatchId)) {
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const nextUrl = urlForPage(page, selectedMatchId, activeGroupId);
    if (currentUrl !== nextUrl) {
      window.history.pushState({}, "", nextUrl);
    }
  }, [activeGroupId, page, selectedMatchId]);

  useEffect(() => {
    const node = mobileNavRefs.current[page];
    if (!node || typeof window === "undefined" || window.innerWidth > 719) return;
    node.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [page]);

  useEffect(() => {
    if (matches.length === 0 || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get("match");
    const pathMatchId = routeFromLocation().matchId;
    const targetMatchId = pathMatchId || sharedMatchId;
    if (!targetMatchId || !matches.some((m) => m.id === targetMatchId)) return;
    setSelectedMatchId(targetMatchId);
    setPage("match");
  }, [matches]);

  useEffect(() => {
    if (matches.length === 0 || typeof window === "undefined") return;
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const upcoming = matches.filter((m) => {
      if (m.status !== "upcoming" || !m.match_date || !m.start_time) return false;
      const matchTime = new Date(`${m.match_date}T${m.start_time}`);
      return matchTime >= now && matchTime <= oneHourLater;
    });
    if (upcoming.length === 0) return;
    const lastReminded = JSON.parse(localStorage.getItem("fut5_reminded") || "{}");
    const newReminders = [];
    upcoming.forEach((m) => {
      if (!lastReminded[m.id]) {
        const confirmed = confirmedAttendances(m.id).length;
        const text = `RECORDATORIO F5MANAGER\n\n${m.title || "Chamuscón"}\nCuándo: ${formatMatchDate(m)}\nDónde: ${m.venue || "Cancha pendiente"}\nConfirmados: ${confirmed}\n\nNos vemos ahí!`;
        newReminders.push({ match: m, text });
        lastReminded[m.id] = now.toISOString();
      }
    });
    if (newReminders.length > 0) {
      localStorage.setItem("fut5_reminded", JSON.stringify(lastReminded));
      setNotice(`Recordatorio: ${newReminders.length} partido(s) empiezan en 1 hora.`);
    }
  }, [matches]);

  function resetState() {
    setProfile(null); setMemberships([]); setActiveGroupId("");
    setProfiles([]); setRatings([]); setMatches([]); setAttendances([]);
    setTeamsByMatch({}); setFines([]); setSettings(null);
    setVenues([]); setMatchFees([]); setCollections([]); setGroupTagRows([]);
    setReservations([]);
    setPage("matches");
  }

  function matchAttendances(matchId) {
    return attendances.filter((a) => a.match_id === matchId);
  }
  function confirmedAttendances(matchId) {
    return matchAttendances(matchId).filter((a) =>
      ["confirmed", "checked_in"].includes(a.status)
    );
  }
  function myAttendance(matchId) {
    return attendances.find((a) => a.match_id === matchId && a.profile_id === profile?.id);
  }
  function goToPage(nextPage) {
    setSelectedMatchId(null);
    setPage(nextPage);
  }
  function openMatch(matchId) { setSelectedMatchId(matchId); setPage("match"); }

  async function bootstrap(user) {
    setError(""); setLoading(true);
    try {
      const p = await api.ensureProfile(user);
      setProfile(p);
      if (profileComplete(p)) await initializeWorkspace(p);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function initializeWorkspace(currentProfile = profile) {
    if (!currentProfile) return null;
    const params = typeof window === "undefined"
      ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const sharedGroupId = params.get("group");
    let rows = await api.listMyGroups(currentProfile.id);
    if (sharedGroupId && !rows.some((m) => m.group_id === sharedGroupId)) {
      try {
        await api.joinGroup(sharedGroupId, currentProfile.id);
        rows = await api.listMyGroups(currentProfile.id);
        setNotice("Solicitud enviada. Un admin del grupo debe activarte para jugar.");
      } catch (joinError) {
        console.error("Error joining group:", joinError);
        // If join fails, continue without joining - user can try again later
        setNotice("No se pudo unir al grupo automáticamente. Intentá de nuevo desde la pestaña Grupos.");
      }
    }
    setMemberships(rows);
    if (rows.length === 0) {
      setActiveGroupId(""); setProfiles([]); setRatings([]); setMatches([]);
      setAttendances([]); setTeamsByMatch({}); setFines([]); setSettings(null);
      setVenues([]); setMatchFees([]); setCollections([]);
      setReservations([]);
      setSelectedMatchId(null); setPage("groups"); return null;
    }
    const stored = typeof window === "undefined"
      ? "" : window.localStorage.getItem("fut5_active_group_id") || "";
    const nextGroupId =
      rows.find((m) => m.group_id === sharedGroupId)?.group_id ||
      rows.find((m) => m.group_id === activeGroupId)?.group_id ||
      rows.find((m) => m.group_id === stored)?.group_id ||
      rows[0].group_id;
    setActiveGroupId(nextGroupId);
    if (typeof window !== "undefined")
      window.localStorage.setItem("fut5_active_group_id", nextGroupId);
    await loadData(currentProfile, nextGroupId);
    return nextGroupId;
  }

  async function loadData(currentProfile = profile, groupId = activeGroupId) {
    if (!currentProfile || !groupId) return;
    const [matchRows, attendanceRows, fineRows, ratingRows, settingRows,
           profileRows, venueRows, collectionRows, tagRows, guestRows,
           statsRows, expensesRows, reservationRows] = await Promise.all([
      api.listMatches(groupId), api.listAttendances(groupId),
      api.listFines(groupId), api.listRatings(groupId),
      api.listSettings(groupId), api.listGroupProfiles(groupId),
      api.listVenues(groupId), api.listCollections(groupId), api.listGroupTags(groupId),
      api.listGroupGuestPlayers(groupId).catch(() => []),
      api.listGroupMatchPlayerStats(groupId).catch(() => []),
      api.listGroupExpenses(groupId).catch(() => []),
      api.listReservations(groupId).catch(() => []),
    ]);
    let voteRows = [];
    try { voteRows = await api.getPlayerVotes(groupId); } catch (e) { console.warn("Votes not available:", e.message); }
    const teamsMap = await api.listAllTeams(matchRows);
    // Load match fees for all matches that have a court cost
    const feePairs = await Promise.all(
      matchRows.filter((m) => Number(m.court_cost) > 0)
        .map(async (m) => api.getMatchFee(m.id))
    );
    setMatches(matchRows || []); setAttendances(attendanceRows || []); setFines(fineRows || []);
    setRatings(ratingRows || []); setSettings(settingRows?.[0] || null);
    setVotes(voteRows || []);
    setProfiles(profileRows || []); setTeamsByMatch(teamsMap || {});
    setGroupTagRows(tagRows || []);
    setReservations(reservationRows || []);
    loadSkills(groupId);
    setVenues(venueRows || []); setCollections(collectionRows || []);
    setMatchFees((feePairs || []).filter(Boolean));
    setMatchStats(statsRows || []);
    setGroupExpenses(expensesRows || []);

    const groupedGuests = {};
    (guestRows || []).forEach((g) => {
      if (g && g.match_id) {
        if (!groupedGuests[g.match_id]) groupedGuests[g.match_id] = [];
        groupedGuests[g.match_id].push(g);
      }
    });
    setGuests(groupedGuests);

    const myProfileRow = (profileRows || []).find((p) => p && p.id === currentProfile.id);
    const userRole = myProfileRow?.membership_role || "player";
    const userIsAdmin = userRole === "admin" || userRole === "super_admin";

    if (userIsAdmin) {
      try {
        const activeIds = (profileRows || [])
          .filter((p) => p && p.membership_is_active)
          .map((p) => p.id);
        await api.syncCollectionPayments(groupId, activeIds);
      } catch (err) {
        console.error("Error syncing collection payments:", err);
      }
    }

    try {
      const updatedCollections = await api.listCollections(groupId);
      setCollections(updatedCollections || []);
    } catch (err) {
      console.error("Error loading collections:", err);
    }

    const memberIds = new Set((profileRows || []).map((p) => p && p.id).filter(Boolean));
    const orphanProfileIds = [...new Set(
      (attendanceRows || [])
        .filter((a) => a && !memberIds.has(a.profile_id))
        .map((a) => a.profile_id)
    )];
    if (orphanProfileIds.length > 0) {
      for (const pid of orphanProfileIds) {
        try { await api.joinGroup(groupId, pid); } catch (e) { /* already joined */ }
      }
      const refreshed = await api.listGroupProfiles(groupId);
      setProfiles(refreshed || []);
    }

    if (!matchRows.some((m) => m.id === selectedMatchId))
      setSelectedMatchId(matchRows[0]?.id || null);
  }

  async function refresh() {
    setNotice(""); setError(""); setLoading(true);
    if (isDemoMode) {
      loadMockData();
      setLoading(false);
      setNotice("Modo Demo Actualizado.");
      return;
    }
    try {
      const fp = profile ? await api.getProfile(profile.id) : profile;
      if (fp) setProfile(fp);
      await initializeWorkspace(fp || profile);
      setNotice(isSuperAdmin ? "Actualizado. Super Admin activo."
        : isAdmin ? "Actualizado. Admin activo." : "Actualizado.");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function switchGroup(groupId) {
    setNotice(""); setError(""); setActiveGroupId(groupId); setSelectedMatchId(null);
    if (typeof window !== "undefined")
      window.localStorage.setItem("fut5_active_group_id", groupId);
    if (isDemoMode) { setPage("matches"); return; }
    setLoading(true);
    try { await loadData(profile, groupId); setPage("matches"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function createGroup(name) {
    setNotice(""); setError(""); setLoading(true);
    try {
      if (isDemoMode) {
        setNotice("En modo demo trabajás sobre un grupo de prueba; crear grupos nuevos requiere iniciar sesión.");
        return;
      }
      const membership = await api.createGroup(profile.id, name);
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows); setActiveGroupId(membership.group_id);
      if (typeof window !== "undefined")
        window.localStorage.setItem("fut5_active_group_id", membership.group_id);
      await loadData(profile, membership.group_id);
      setNotice("Grupo creado. Ya sos Super Admin de esta chamusca.");
      setPage("admin");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function requestJoinGroup(groupId) {
    if (!profile || !groupId) return;
    setNotice(""); setError(""); setLoading(true);
    try {
      if (isDemoMode) {
        setNotice("En modo demo ya estás dentro de un grupo de prueba.");
        return;
      }
      await api.joinGroup(groupId, profile.id);
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows);
      const membership = rows.find((m) => m.group_id === groupId) || rows[0];
      if (membership?.group_id) {
        setActiveGroupId(membership.group_id);
        if (typeof window !== "undefined")
          window.localStorage.setItem("fut5_active_group_id", membership.group_id);
        await loadData(profile, membership.group_id);
      }
      setNotice("Solicitud enviada. Un admin del grupo debe activarte para jugar.");
      setPage("matches");
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function confirmMatch(match) {
    setNotice(""); setError("");
    if (!clearance.clear && !isAdmin) {
      setError(`Necesitás finiquito para sumarte. Pendiente: ${new Intl.NumberFormat(undefined, { style: "currency", currency: "GTQ" }).format(clearance.total)}.`);
      setPage("fees");
      return;
    }
    if (!canAccessMatch(match, currentPlayer, isAdmin)) {
      setError("Este partido es exclusivo para otros tags del grupo.");
      return;
    }
    if (!isActiveMember) {
      const isMember = memberships.some((m) => m.group_id === activeGroupId);
      if (!isMember && activeGroupId) {
        try {
          if (isDemoMode) {
            const mockMembership = { group_id: activeGroupId, role: "player", is_active: true };
            setMemberships((c) => [...c, mockMembership]);
            setNotice("Te uniste al grupo (Simulación Local).");
            return;
          }
          const membership = await api.joinGroup(activeGroupId, profile.id);
          setMemberships((c) => [...c, membership]);
          const updatedProfiles = await api.listGroupProfiles(activeGroupId);
          setProfiles(updatedProfiles);
          setNotice("Te uniste al grupo. Un admin debe activarte para poder confirmar asistencia.");
        } catch (joinErr) {
          setError("No se pudo unir al grupo. Intentá de nuevo.");
        }
      } else {
        setError("Tu membresía está inactiva. Pedile a un admin que te active.");
      }
      return;
    }
    try {
      if (isDemoMode) {
        const row = {
          id: `att-mock-${Date.now()}`,
          match_id: match.id,
          profile_id: profile.id,
          status: "confirmed",
          checked_in: false,
          created_at: new Date().toISOString()
        };
        setAttendances((c) => [...c.filter((a) => a.match_id !== match.id || a.profile_id !== profile.id), row]);
        setNotice("Asistencia confirmada (Simulación Local).");
        return;
      }
      const row = await api.confirmAttendance(match.id, profile.id);
      setAttendances((c) => [...c.filter((a) => a.id !== row.id), row]);

      const relatedFines = fines.filter(
        (f) => f.match_id === match.id && f.profile_id === profile.id && ["no_show", "late_cancel"].includes(f.reason)
      );
      for (const fine of relatedFines) {
        await api.deleteFine(fine.id);
      }
      if (relatedFines.length > 0) {
        setFines((c) => c.filter((f) => !relatedFines.some((rf) => rf.id === f.id)));
      }

      const match_ = matches.find((m) => m.id === match.id);
      if (Number(match_?.court_cost) > 0) {
        const newConfirmed = [...confirmedAttendances(match.id).map((a) => a.profile_id),
          ...(confirmedAttendances(match.id).some((a) => a.profile_id === profile.id)
            ? [] : [profile.id])];
        const due = match_.match_date
          ? new Date(`${match_.match_date}T${match_.start_time || "00:00"}`).toISOString()
          : null;
        const fee = await api.upsertMatchFee(
          match.id, activeGroupId, match_.court_cost, newConfirmed, due
        );
        if (fee) setMatchFees((c) => [...c.filter((f) => f.match_id !== match.id), fee]);
      }
      setNotice("Asistencia confirmada.");
    } catch (err) { setError(err.message); }
  }

  async function joinWaitlist(match) {
    setNotice(""); setError("");
    if (!clearance.clear && !isAdmin) {
      setError(`Necesitás finiquito para entrar a lista de espera. Pendiente: ${new Intl.NumberFormat(undefined, { style: "currency", currency: "GTQ" }).format(clearance.total)}.`);
      setPage("fees");
      return;
    }
    if (!canAccessMatch(match, currentPlayer, isAdmin)) {
      setError("Este partido es exclusivo para otros tags del grupo.");
      return;
    }
    if (!isActiveMember) {
      const isMember = memberships.some((m) => m.group_id === activeGroupId);
      if (!isMember && activeGroupId) {
        try {
          if (isDemoMode) {
            const mockMembership = { group_id: activeGroupId, role: "player", is_active: true };
            setMemberships((c) => [...c, mockMembership]);
            setNotice("Te uniste al grupo (Simulación Local).");
            return;
          }
          const membership = await api.joinGroup(activeGroupId, profile.id);
          setMemberships((c) => [...c, membership]);
          setNotice("Te uniste al grupo. Un admin debe activarte para unirte a la lista de espera.");
        } catch (joinErr) {
          setError("No se pudo unir al grupo.");
        }
      } else {
        setError("Tu membresía está inactiva.");
      }
      return;
    }
    try {
      if (isDemoMode) {
        const row = {
          id: `att-mock-${Date.now()}`,
          match_id: match.id,
          profile_id: profile.id,
          status: "waitlist",
          checked_in: false,
          created_at: new Date().toISOString()
        };
        setAttendances((c) => [...c.filter((a) => a.match_id !== match.id || a.profile_id !== profile.id), row]);
        setNotice("Te agregaste a la lista de espera (Simulación Local).");
        return;
      }
      const row = await api.joinWaitlist(match.id, profile.id, activeGroupId);
      setAttendances((c) => [...c.filter((a) => a.id !== row.id), row]);
      setNotice("Te agregaste a la lista de espera.");
    } catch (err) { setError(err.message); }
  }

  async function cancelMatch(match) {
    setNotice(""); setError("");
    const attendance = myAttendance(match.id);
    if (!attendance) return;
    try {
      const existing = fines.find(
        (f) => f.match_id === match.id && f.profile_id === profile.id && f.reason === "late_cancel"
      );
      if (existing) {
        setNotice("Ya existe una multa por cancelación tardía para este partido.");
        return;
      }

      const matchDateTime = new Date(`${match.match_date}T${match.start_time || "00:00"}`);
      const now = new Date();
      const hoursUntilMatch = (matchDateTime - now) / (1000 * 60 * 60);
      const isLateCancel = hoursUntilMatch < 4;

      if (isDemoMode) {
        const updated = { ...attendance, status: "canceled", checked_in: false };
        setAttendances((c) => c.map((a) => (a.id === attendance.id ? updated : a)));

        if (isLateCancel) {
          const fine = {
            id: `fine-mock-${Date.now()}`,
            group_id: activeGroupId,
            profile_id: profile.id,
            match_id: match.id,
            reason: "late_cancel",
            amount: lateCancelFineAmount,
            status: "open",
            created_at: new Date().toISOString()
          };
          setFines((c) => [fine, ...c]);
        }

        const nextInWaitlist = attendances
          .filter((a) => a.match_id === match.id && a.status === "waitlist")
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

        if (nextInWaitlist) {
          const promoted = { ...nextInWaitlist, status: "confirmed" };
          setAttendances((c) => c.map((a) => a.id === nextInWaitlist.id ? promoted : a));
          setNotice(isLateCancel
            ? `Cancelación tardía. Multa de Q${lateCancelFineAmount}. Alguien de la lista de espera fue promovido (Simulación Local).`
            : `Asistencia cancelada. Alguien de la lista de espera fue promovido (Simulación Local).`);
        } else {
          setNotice(isLateCancel
            ? `Cancelación tardía. Multa de Q${lateCancelFineAmount} generada (Simulación Local).`
            : `Asistencia cancelada (Simulación Local).`);
        }
        return;
      }

      const updated = await api.updateAttendance(attendance.id, { status: "canceled", checked_in: false });
      setAttendances((c) => c.map((a) => (a.id === updated.id ? updated : a)));

      if (isLateCancel) {
        const fine = await api.createFine({
          group_id: activeGroupId, profile_id: profile.id,
          match_id: match.id, reason: "late_cancel",
          amount: lateCancelFineAmount, status: "open",
        });
        setFines((c) => [fine, ...c]);
      }

      const promoted = await api.promoteFromWaitlist(match.id);
      if (promoted) {
        setAttendances((c) => [...c.filter((a) => a.id !== promoted.id), promoted]);
        setNotice(isLateCancel
          ? `Cancelación tardía. Multa de Q${lateCancelFineAmount}. Alguien de la lista de espera fue promovido.`
          : "Asistencia cancelada. Alguien de la lista de espera fue promovido.");
      } else {
        setNotice(isLateCancel
          ? `Cancelación tardía. Multa de Q${lateCancelFineAmount} generada.`
          : "Asistencia cancelada.");
      }
    } catch (err) { setError(err.message); }
  }

  async function saveProfile(payload, avatarFile) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        let localAvatarUrl = profile.avatar_url;
        if (avatarFile) {
          localAvatarUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(avatarFile);
          });
        }
        const updated = {
          ...profile,
          ...payload,
          avatar_url: localAvatarUrl,
        };
        setProfile(updated);
        setProfiles((c) => c.map((p) => (p.id === updated.id ? updated : p)));
        setNotice("Perfil guardado (Simulación Local).");
        setPage("matches");
        return;
      }
      let updated = await api.updateMyProfile(profile.id, payload);
      if (avatarFile) updated = await api.uploadAvatar(profile.id, avatarFile);
      setProfile(updated);
      setProfiles((c) => c.some((p) => p.id === updated.id)
        ? c.map((p) => (p.id === updated.id ? updated : p)) : [updated]);
      if (activeGroupId) { await loadData(updated, activeGroupId); setPage("matches"); }
      else { const g = await initializeWorkspace(updated); setPage(g ? "matches" : "groups"); }
      setNotice("Perfil guardado.");
    } catch (err) { setError(err.message); }
  }

  async function signOut() {
    if (isDemoMode) {
      setIsDemoMode(false);
      resetState();
    } else {
      await supabase.auth.signOut();
      setSession(null);
      resetState();
    }
  }

  async function createMatch(payload) {
    setNotice(""); setError("");
    if (!activeGroupId) { setError("Primero creá o seleccioná un grupo."); return null; }
    try {
      if (isDemoMode) {
        const mockMatch = {
          id: `m-mock-${Date.now()}`,
          group_id: activeGroupId,
          ...payload,
          status: payload.status || "upcoming",
          created_at: new Date().toISOString()
        };
        setMatches((c) => [...c, mockMatch]);
        setSelectedMatchId(mockMatch.id);
        setNotice("Partido creado (Simulación Local).");
        return mockMatch;
      }
      let created = await api.createMatch({ ...payload, group_id: activeGroupId });
      setMatches((c) => [...c, created]);
      setSelectedMatchId(created.id);
      // Auto-create match fee if court_cost > 0
      if (Number(created.court_cost) > 0) {
        const due = created.match_date
          ? new Date(`${created.match_date}T${created.start_time || "00:00"}`).toISOString()
          : null;
        const fee = await api.upsertMatchFee(created.id, activeGroupId, created.court_cost, [], due);
        if (fee) setMatchFees((c) => [...c, fee]);
      }
      setNotice("Partido creado.");
      return created;
    } catch (err) { setError(err.message); return null; }
  }

  async function editMatch(matchId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setMatches((c) => c.map((m) => {
          if (m.id === matchId) {
            return { ...m, ...payload };
          }
          return m;
        }));
        setNotice("Partido actualizado (Simulación Local).");
        return;
      }
      const updated = await api.updateMatch(matchId, payload);
      setMatches((c) => c.map((m) => (m.id === updated.id ? updated : m)));
      setNotice("Partido actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function deleteMatch(matchId) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setMatches((c) => c.filter((m) => m.id !== matchId));
        setTeamsByMatch((c) => { const n = { ...c }; delete n[matchId]; return n; });
        setMatchFees((c) => c.filter((f) => f.match_id !== matchId));
        if (selectedMatchId === matchId) { setSelectedMatchId(null); setPage("matches"); }
        setNotice("Partido eliminado (Simulación Local).");
        return;
      }
      await api.deleteMatch(matchId);
      setMatches((c) => c.filter((m) => m.id !== matchId));
      setTeamsByMatch((c) => { const n = { ...c }; delete n[matchId]; return n; });
      setMatchFees((c) => c.filter((f) => f.match_id !== matchId));
      if (selectedMatchId === matchId) { setSelectedMatchId(null); setPage("matches"); }
      setNotice("Partido eliminado.");
    } catch (err) { setError(err.message); }
  }

  async function updateProfileAdmin(profileId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setProfiles((c) => c.map((p) => {
          if (p.id === profileId) {
            const updated = { ...p, ...payload };
            if (profileId === profile.id) setProfile(updated);
            return updated;
          }
          return p;
        }));
        setNotice("Jugador actualizado (Simulación Local).");
        return;
      }
      const updated = await api.updateProfileAdmin(profileId, payload);
      setProfiles((c) => c.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      if (updated.id === profile.id) setProfile(updated);
      setNotice("Jugador actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function createGroupTag(name) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const mockTag = {
          id: `tag-mock-${Date.now()}`,
          name: name.trim().toLowerCase().replace(/\s+/g, "-"),
          group_id: activeGroupId,
          created_by: profile?.id || "admin"
        };
        setGroupTagRows((rows) => [...rows.filter((row) => row.id !== mockTag.id && row.name !== mockTag.name), mockTag]
          .sort((a, b) => a.name.localeCompare(b.name)));
        setNotice("Tag guardado (Simulación Local).");
        return mockTag.name;
      }
      const tag = await api.createGroupTag(activeGroupId, name, profile?.id);
      setGroupTagRows((rows) => [...rows.filter((row) => row.id !== tag.id && row.name !== tag.name), tag]
        .sort((a, b) => a.name.localeCompare(b.name)));
      setNotice("Tag guardado.");
      return tag.name;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function updateGroupMember(profileId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setProfiles((c) => c.map((p) => {
          if (p.id === profileId) {
            return { ...p, ...payload };
          }
          return p;
        }));
        setNotice("Membresía actualizada (Simulación Local).");
        return;
      }
      await api.updateGroupMember(activeGroupId, profileId, payload);
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows); await loadData(profile, activeGroupId);
      setNotice("Membresía actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function updateMemberRole(profileId, role) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setMemberships((c) => c.map((m) => {
          if (m.group_id === activeGroupId) {
            return { ...m, role };
          }
          return m;
        }));
        if (profileId === profile.id) {
          setDevRoleOverride(role);
        }
        setNotice("Rol actualizado (Simulación Local).");
        return;
      }
      await api.updateMemberRole(activeGroupId, profileId, role);
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows); await loadData(profile, activeGroupId);
      setNotice("Rol actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function assignRating(profileId, positionKey, level) {
    setNotice(""); setError("");
    try {
      const current = ratingMap.get(profileId) || {};
      const positionRatings = {
        attack_rating: current.attack_rating || current.rating || 2,
        defense_rating: current.defense_rating || current.rating || 2,
        midfield_rating: current.midfield_rating || current.rating || 2,
        goalkeeper_rating: current.goalkeeper_rating || current.rating || 2,
      };
      positionRatings[positionKey] = level;
      const values = [
        positionRatings.attack_rating,
        positionRatings.defense_rating,
        positionRatings.midfield_rating,
        positionRatings.goalkeeper_rating,
      ];
      const overallRating = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

      if (isDemoMode) {
        const mockRating = {
          id: `rating-mock-${profileId}-${Date.now()}`,
          profile_id: profileId,
          rating: overallRating,
          ...positionRatings,
          assigned_by: profile.id,
          created_at: new Date().toISOString()
        };
        setRatings((c) => [mockRating, ...c.filter((r) => r.profile_id !== profileId)]);
        setNotice("Estrellas asignadas (Simulación Local).");
        return;
      }

      const created = await api.assignRating(
        activeGroupId,
        profileId,
        overallRating,
        profile.id,
        positionRatings,
      );
      setRatings((c) => [created, ...c]);
      setNotice("Estrellas asignadas.");
    } catch (err) { setError(err.message); }
  }

  async function generateTeams(match, options = {}) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const matchAttendances = attendances.filter(
          (a) => a.match_id === match.id && ["confirmed", "checked_in"].includes(a.status),
        );
        const confirmedIds = matchAttendances.map((a) => a.profile_id);
        const playersList = profiles
          .filter((p) => confirmedIds.includes(p.id))
          .map((p) => {
            const r = ratingMap.get(p.id) || { rating: 70 };
            return {
              ...p,
              rating: r.rating || 70,
            };
          });

        const matchGuests = guests[match.id] || [];
        matchGuests.forEach((g) => {
          playersList.push({
            id: g.id,
            full_name: g.name,
            nickname: g.name,
            preferred_position: "Flexible",
            rating: g.rating || 70,
            is_guest: true
          });
        });

        playersList.sort((a, b) => b.rating - a.rating);
        const team1 = [];
        const team2 = [];
        playersList.forEach((p, idx) => {
          if (idx % 2 === 0) team1.push(p);
          else team2.push(p);
        });

        const mockTeamsResult = [
          {
            id: `team-mock-1-${Date.now()}`,
            name: "Equipo 1",
            color: "var(--primary)",
            team_members: team1.map((p) => ({ profile_id: p.id, profiles: p }))
          },
          {
            id: `team-mock-2-${Date.now()}`,
            name: "Equipo 2",
            color: "#3b82f6",
            team_members: team2.map((p) => ({ profile_id: p.id, profiles: p }))
          }
        ];

        setTeamsByMatch((c) => ({ ...c, [match.id]: mockTeamsResult }));
        setNotice("Equipos generados (Simulación Local).");
        return;
      }

      const freshProfiles = await api.listGroupProfiles(activeGroupId);
      setProfiles(freshProfiles);

      if (options.aiTeams) {
        options.aiAssignments = options.aiTeams.teams;
      }

      const result = await api.generateTeamsForMatch(match, freshProfiles, attendances, ratings, options);
      setTeamsByMatch((c) => ({ ...c, [match.id]: result.teams }));
      setNotice(options.aiFallback
        ? "La IA devolvió equipos incompletos; se generaron equipos automáticos con todos los confirmados."
        : options.aiTeams ? "Equipos distribuidos por IA." : "Equipos generados.");
    } catch (err) { setError(err.message); }
  }

  async function loadGuests(matchId) {
    if (isDemoMode) return;
    try {
      const rows = await api.listGuestPlayers(matchId);
      setGuests((c) => ({ ...c, [matchId]: rows }));
    } catch (err) {
      console.error("Error loading guests:", err);
      setGuests((c) => ({ ...c, [matchId]: [] }));
    }
  }

  async function addGuestPlayer(matchId, name, rating) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const guest = {
          id: `guest-mock-${Date.now()}`,
          match_id: matchId,
          group_id: activeGroupId,
          name,
          rating: rating || 70,
          created_by: profile.id,
          created_at: new Date().toISOString()
        };
        setGuests((c) => ({ ...c, [matchId]: [...(c[matchId] || []), guest] }));
        setNotice(`${name} agregado como invitado (Simulación Local).`);
        return;
      }
      const guest = await api.addGuestPlayer(matchId, activeGroupId, name, rating, profile.id);
      setGuests((c) => ({ ...c, [matchId]: [...(c[matchId] || []), guest] }));
      setNotice(`${name} agregado como invitado.`);
    } catch (err) { setError(err.message); }
  }

  async function deleteGuestPlayer(matchId, guestId) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setGuests((c) => ({ ...c, [matchId]: (c[matchId] || []).filter((g) => g.id !== guestId) }));
        setNotice("Invitado eliminado (Simulación Local).");
        return;
      }
      await api.deleteGuestPlayer(guestId);
      setGuests((c) => ({ ...c, [matchId]: (c[matchId] || []).filter((g) => g.id !== guestId) }));
      setNotice("Invitado eliminado.");
    } catch (err) { setError(err.message); }
  }

  async function updateGuestRating(matchId, guestId, rating) {
    try {
      if (isDemoMode) {
        setGuests((c) => ({
          ...c,
          [matchId]: (c[matchId] || []).map((g) => (g.id === guestId ? { ...g, rating } : g))
        }));
        return;
      }
      const updated = await api.updateGuestPlayer(guestId, { rating });
      setGuests((c) => ({ ...c, [matchId]: (c[matchId] || []).map((g) => g.id === guestId ? updated : g) }));
    } catch (err) { setError(err.message); }
  }

  async function saveMatchStats(matchId, statsArray) {
    if (!profile) return;
    try {
      setError(null);
      if (isDemoMode) {
        const savedRows = statsArray.map((s, i) => ({
          id: `stat-demo-${matchId}-${i}-${Date.now()}`, match_id: matchId, group_id: activeGroupId,
          player_id: s.player_id ?? null, guest_player_id: s.guest_player_id ?? null,
          goals: s.goals || 0, assists: s.assists || 0, mvp: !!s.mvp, clean_sheet: !!s.clean_sheet,
        }));
        setMatchStats((prev) => [...prev.filter((s) => s.match_id !== matchId), ...savedRows]);
        setMatches((c) => c.map((m) => (m.id === matchId ? { ...m, status: "closed" } : m)));
        return;
      }
      const savedRows = await api.saveMatchPlayerStats(matchId, activeGroupId, statsArray, profile.id);
      setMatchStats((prev) => [
        ...prev.filter((s) => s.match_id !== matchId),
        ...savedRows,
      ]);
      const match = matches.find((m) => m.id === matchId);
      if (match && match.status !== "closed") {
        const updated = await api.updateMatch(matchId, { status: "closed" });
        setMatches((c) => c.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (err) {
      console.error("Error saving match stats:", err);
      setError(err.message);
      alert("Error al guardar estadísticas: " + err.message);
    }
  }

  async function addExpense(description, amount, category, date) {
    if (!profile) return;
    try {
      setError(null);
      if (isDemoMode) {
        setGroupExpenses((prev) => [{
          id: `exp-demo-${Date.now()}`, group_id: activeGroupId, concept: description, description,
          amount: Number(amount) || 0, category, date, created_at: new Date().toISOString(),
        }, ...prev]);
        return;
      }
      const newExpense = await api.addGroupExpense(activeGroupId, description, amount, category, date, profile.id);
      setGroupExpenses((prev) => [newExpense, ...prev]);
    } catch (err) {
      console.error("Error adding expense:", err);
      setError(err.message);
      alert("Error al guardar egreso: " + err.message);
    }
  }

  async function deleteExpense(expenseId) {
    try {
      setError(null);
      if (!isDemoMode) await api.deleteGroupExpense(expenseId);
      setGroupExpenses((prev) => prev.filter((exp) => exp.id !== expenseId));
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError(err.message);
      alert("Error al eliminar egreso: " + err.message);
    }
  }

  async function loadSkills(gId) {
    const targetGroupId = gId || activeGroupId;
    if (!targetGroupId) return;
    if (isDemoMode) return; // en demo los skills ya están sembrados en memoria
    try {
      const rows = await api.listPlayerSkills(targetGroupId);
      setSkills(rows || []);
    } catch (err) {
      console.warn("Skills not available:", err.message);
      setSkills([]);
    }
  }

  async function addSkill(playerId, skill) {
    if (!profile) return;
    try {
      if (isDemoMode) {
        setSkills((c) => [...c.filter((s) => !(s.player_id === playerId && s.skill === skill)),
          { id: `skill-demo-${playerId}-${skill}-${Date.now()}`, group_id: activeGroupId, player_id: playerId, skill }]);
        return;
      }
      const row = await api.addPlayerSkill(activeGroupId, playerId, skill, profile.id);
      setSkills((c) => [...c.filter((s) => !(s.player_id === playerId && s.skill === skill)), row]);
    } catch (err) {
      console.error("Error adding skill:", err);
      setError(err.message);
      alert("Error al guardar habilidad: " + err.message);
    }
  }

  async function removeSkill(skillId) {
    try {
      if (!isDemoMode) await api.removePlayerSkill(skillId);
      setSkills((c) => c.filter((s) => s.id !== skillId));
    } catch (err) {
      console.error("Error removing skill:", err);
      setError(err.message);
      alert("Error al quitar habilidad: " + err.message);
    }
  }

  async function updateAttendance(attendanceId, payload) {
    if (isDemoMode) {
      let updated = null;
      setAttendances((c) => c.map((a) => {
        if (a.id === attendanceId) { updated = { ...a, ...payload }; return updated; }
        return a;
      }));
      return updated || { id: attendanceId, ...payload };
    }
    const updated = await api.updateAttendance(attendanceId, payload);
    setAttendances((c) => c.map((a) => (a.id === updated.id ? updated : a)));
    return updated;
  }

  async function markNoShow(attendance) {
    setNotice(""); setError("");
    try {
      const existing = fines.find(
        (f) => f.match_id === attendance.match_id && f.profile_id === attendance.profile_id && f.reason === "no_show"
      );
      if (existing) {
        setNotice("Ya existe una multa por no llegada para este jugador en este partido.");
        return;
      }
      const updated = await updateAttendance(attendance.id, { status: "no_show", checked_in: false });
      const finePayload = {
        group_id: activeGroupId, profile_id: attendance.profile_id,
        match_id: attendance.match_id, reason: "no_show",
        amount: settings?.fine_amount || 50, status: "open",
      };
      const fine = isDemoMode
        ? { id: `fine-demo-${Date.now()}`, ...finePayload }
        : await api.createFine(finePayload);
      setFines((c) => [fine, ...c]);
      setNotice(`${displayName(profileById.get(updated.profile_id))} marcado como no llegó.`);
    } catch (err) { setError(err.message); }
  }

  async function updateFine(fineId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setFines((c) => c.map((f) => (f.id === fineId ? { ...f, ...payload } : f)));
        setNotice("Multa actualizada (Simulación Local).");
        return;
      }
      const updated = await api.updateFine(fineId, payload);
      setFines((c) => c.map((f) => (f.id === updated.id ? updated : f)));
      setNotice("Multa actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function createFine(payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const fine = { id: `fine-demo-${Date.now()}`, ...payload };
        setFines((c) => [fine, ...c]);
        setNotice("Multa creada (Simulación Local).");
        return fine;
      }
      const fine = await api.createFine(payload);
      setFines((c) => [fine, ...c]);
      setNotice("Multa creada.");
      return fine;
    } catch (err) { setError(err.message); }
  }

  async function createVenue(payload, photoFile) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const venue = { id: `venue-demo-${Date.now()}`, ...payload, photo_url: photoFile ? URL.createObjectURL(photoFile) : null };
        setVenues((c) => [...c, venue]);
        setNotice("Cancha agregada (Simulación Local).");
        return;
      }
      let venue = await api.createVenue(payload);
      if (photoFile) venue = await api.uploadVenuePhoto(venue.id, photoFile);
      setVenues((c) => [...c, venue]);
      setNotice("Cancha agregada al catálogo.");
    } catch (err) { setError(err.message); }
  }

  async function updateVenue(venueId, payload, photoFile) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setVenues((c) => c.map((v) => (v.id === venueId
          ? { ...v, ...payload, photo_url: photoFile ? URL.createObjectURL(photoFile) : v.photo_url }
          : v)));
        setNotice("Cancha actualizada (Simulación Local).");
        return;
      }
      let venue = await api.updateVenue(venueId, payload);
      if (photoFile) venue = await api.uploadVenuePhoto(venueId, photoFile);
      setVenues((c) => c.map((v) => (v.id === venue.id ? venue : v)));
      setNotice("Cancha actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function createCollection(payload) {
    setNotice(""); setError("");
    try {
      const activeIds = profiles.filter((p) => p.membership_is_active).map((p) => p.id);
      if (isDemoMode) {
        const cid = `col-demo-${Date.now()}`;
        const col = {
          id: cid, group_id: activeGroupId, created_by: profile?.id, ...payload, status: "open",
          collection_payments: activeIds.map((pv, i) => ({
            id: `cp-demo-${cid}-${i}`, collection_id: cid, group_id: activeGroupId,
            profile_id: pv, status: "pending", proof_status: null, proof_url: null,
          })),
        };
        setCollections((c) => [col, ...c]);
        setNotice("Colaboración creada (Simulación Local).");
        return;
      }
      const col = await api.createCollection(
        { ...payload, group_id: activeGroupId, created_by: profile.id }, activeIds
      );
      setCollections((c) => [col, ...c.filter((x) => x.id !== col.id)]);
      setNotice("Colaboración creada.");
    } catch (err) { setError(err.message); }
  }

  async function updateCollectionPayment(paymentId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setCollections((c) => c.map((col) => ({
          ...col,
          collection_payments: (col.collection_payments || []).map(
            (p) => (p.id === paymentId
              ? { ...p, ...payload, paid_at: payload.status === "paid" ? new Date().toISOString() : p.paid_at }
              : p)
          ),
        })));
        setNotice("Pago actualizado (Simulación Local).");
        return;
      }
      const updated = await api.updateCollectionPayment(paymentId, payload);
      setCollections((c) => c.map((col) => ({
        ...col,
        collection_payments: (col.collection_payments || []).map(
          (p) => (p.id === updated.id ? updated : p)
        ),
      })));
      setNotice("Pago actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function closeCollection(collectionId) {
    setNotice(""); setError("");
    try {
      if (!isDemoMode) await api.updateCollection(collectionId, { status: "closed" });
      setCollections((c) => c.map((col) =>
        col.id === collectionId ? { ...col, status: "closed" } : col
      ));
      setNotice(isDemoMode ? "Colaboración cerrada (Simulación Local)." : "Colaboración cerrada.");
    } catch (err) { setError(err.message); }
  }

  async function deleteCollection(collectionId) {
    setNotice(""); setError("");
    try {
      if (!isDemoMode) await api.deleteCollection(collectionId);
      setCollections((c) => c.filter((col) => col.id !== collectionId));
      setNotice(isDemoMode ? "Colaboración eliminada (Simulación Local)." : "Colaboración eliminada.");
    } catch (err) { setError(err.message); }
  }

  async function updateCollection(collectionId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setCollections((c) => c.map((col) => (col.id === collectionId ? { ...col, ...payload } : col)));
        setNotice("Colaboración actualizada (Simulación Local).");
        return;
      }
      const updated = await api.updateCollection(collectionId, payload);
      setCollections((c) => c.map((col) =>
        col.id === collectionId ? { ...col, ...updated } : col
      ));
      setNotice("Colaboración actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function updateMatchFee(feeId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setMatchFees((c) => c.map((fee) => (fee.id === feeId ? { ...fee, ...payload } : fee)));
        setNotice("Cobro de cancha actualizado (Simulación Local).");
        return;
      }
      const updated = await api.updateMatchFee(feeId, payload);
      setMatchFees((c) => c.map((fee) =>
        fee.id === feeId ? { ...fee, ...updated } : fee
      ));
      setNotice("Cobro de cancha actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function updateMatchFeePayment(paymentId, payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setMatchFees((c) => c.map((fee) => ({
          ...fee,
          match_fee_payments: (fee.match_fee_payments || []).map(
            (p) => (p.id === paymentId
              ? { ...p, ...payload, paid_at: payload.status === "paid" ? new Date().toISOString() : p.paid_at }
              : p)
          ),
        })));
        setNotice("Pago actualizado (Simulación Local).");
        return;
      }
      const updated = await api.updateMatchFeePayment(paymentId, payload);
      setMatchFees((c) => c.map((fee) => ({
        ...fee,
        match_fee_payments: (fee.match_fee_payments || []).map(
          (p) => (p.id === updated.id ? updated : p)
        ),
      })));
      setNotice("Pago actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function reviewProof(paymentId, paymentType, status, rejectionReason = null) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        const patch = (p) => ({
          ...p, proof_status: status, proof_reviewed_at: new Date().toISOString(),
          proof_rejection_reason: rejectionReason,
          status: status === "approved" ? "paid" : p.status,
          paid_at: status === "approved" ? new Date().toISOString() : p.paid_at,
        });
        if (paymentType === "match_fee") {
          setMatchFees((c) => c.map((fee) => ({
            ...fee,
            match_fee_payments: (fee.match_fee_payments || []).map((p) => (p.id === paymentId ? patch(p) : p)),
          })));
        } else {
          setCollections((c) => c.map((col) => ({
            ...col,
            collection_payments: (col.collection_payments || []).map((p) => (p.id === paymentId ? patch(p) : p)),
          })));
        }
        setNotice(status === "approved" ? "Comprobante aprobado (Simulación Local)." : "Comprobante rechazado (Simulación Local).");
        return;
      }
      await api.reviewPaymentProof(paymentId, paymentType, status, rejectionReason);

      // Update local state
      if (paymentType === "match_fee") {
        setMatchFees((c) => c.map((fee) => ({
          ...fee,
          match_fee_payments: (fee.match_fee_payments || []).map(
            (p) => (p.id === paymentId
              ? { ...p, proof_status: status, proof_reviewed_at: new Date().toISOString(),
                  proof_rejection_reason: rejectionReason,
                  status: status === "approved" ? "paid" : p.status,
                  paid_at: status === "approved" ? new Date().toISOString() : p.paid_at }
              : p)
          ),
        })));
      } else {
        setCollections((c) => c.map((col) => ({
          ...col,
          collection_payments: (col.collection_payments || []).map(
            (p) => (p.id === paymentId
              ? { ...p, proof_status: status, proof_reviewed_at: new Date().toISOString(),
                  proof_rejection_reason: rejectionReason,
                  status: status === "approved" ? "paid" : p.status,
                  paid_at: status === "approved" ? new Date().toISOString() : p.paid_at }
              : p)
          ),
        })));
      }

      setNotice(status === "approved" ? "Comprobante aprobado." : "Comprobante rechazado.");
    } catch (err) { setError(err.message); }
  }

  async function updateSettings(payload) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setSettings((s) => ({ ...(s || { group_id: activeGroupId }), ...payload }));
        setNotice("Configuración guardada (Simulación Local).");
        return;
      }
      const updated = await api.updateSettings(activeGroupId, payload);
      setSettings(updated);
      setNotice("Configuración guardada.");
    } catch (err) { setError(err.message); }
  }

  async function removeGroupMember(profileId) {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setProfiles((c) => c.map((p) => (p.id === profileId ? { ...p, membership_is_active: false } : p)));
        setNotice("Jugador removido (Simulación Local).");
        return;
      }
      await api.removeGroupMember(activeGroupId, profileId);
      // Reload profiles and memberships
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows);
      await loadData(profile, activeGroupId);
      setNotice("Jugador removido del grupo.");
    } catch (err) { setError(err.message); }
  }

  async function deleteMyAccount() {
    setNotice(""); setError("");
    try {
      if (isDemoMode) {
        setIsDemoMode(false);
        resetState();
        setNotice("Saliste del modo demo.");
        return;
      }
      await api.deleteMyAccount(profile.id);
      // api.deleteMyAccount signs out — auth state change will reset state
      resetState();
      setSession(null);
    } catch (err) { setError(err.message); }
  }

  // Check if we're on the proof upload page
  const proofTokenMatch = typeof window !== "undefined"
    ? window.location.pathname.match(/^\/proof\/(.+)$/)
    : null;
  const proofToken = proofTokenMatch?.[1];

  const guestTokenMatch = typeof window !== "undefined"
    ? window.location.pathname.match(/^\/guest\/(.+)$/)
    : null;
  const guestToken = guestTokenMatch?.[1];

  // Render guest registration page (no auth required)
  if (guestToken) {
    return <GuestRegisterPage token={guestToken} />;
  }

  const reserveTokenMatch = typeof window !== "undefined"
    ? window.location.pathname.match(/^\/reserve\/(.+)$/)
    : null;
  const reserveToken = reserveTokenMatch?.[1];

  // Render reserve page (no auth required)
  if (reserveToken) {
    return <ReservePage token={reserveToken} />;
  }

  // Render guards
  if (!sessionReady && !isDemoMode) return <ShellMessage title="Cargando" message="Revisando tu sesión..." />;

  // Render proof upload page (requires auth, so we prompt login first if no session)
  if (proofToken && !session && !isDemoMode) {
    return (
      <AuthScreen
        onMockLogin={() => {
          setIsDemoMode(true);
          loadMockData();
        }}
      />
    );
  }
  if (proofToken) {
    return <ProofUploadPage token={proofToken} session={session} />;
  }

  const isPublicRoute = ["landing", "blog", "privacy", "terms", "contact", "auth"].includes(page);

  // Auto-redirect logged-in users away from auth/landing to the app
  if (session && !isDemoMode && (page === "landing" || page === "auth")) {
    window.history.replaceState({}, "", "/partidos");
    setPage("matches");
  }

  if (!session && !isDemoMode) {
    if (page === "blog") return <BlogPage />;
    if (page === "privacy") return <PrivacyPage />;
    if (page === "terms") return <TermsPage />;
    if (page === "contact") return <ContactPage />;
    if (page === "auth") {
      return (
        <AuthScreen
          onMockLogin={() => {
            setIsDemoMode(true);
            loadMockData();
          }}
        />
      );
    }
    // Default to LandingPage for unauthenticated users on any other route
    return (
      <LandingPage 
        onLogin={() => { 
          setPage("auth"); 
          window.history.pushState({}, "", "/login"); 
        }} 
      />
    );
  }

  // If a logged-in user explicitly visits a public page, show it
  if (page === "blog") return <BlogPage />;
  if (page === "privacy") return <PrivacyPage />;
  if (page === "terms") return <TermsPage />;
  if (page === "contact") return <ContactPage />;

  if (loading && !profile) return <ShellMessage title="Cargando" message="Preparando tu perfil..." />;
  if (profile && !profileComplete(profile)) {
    return (
      <div className="app auth-shell">
        <ProfileForm initialProfile={profile} mode="complete" onSave={saveProfile} onSignOut={signOut} />
      </div>
    );
  }
  if (profile && loading && memberships.length === 0 && !activeGroupId) {
    return <ShellMessage title="Cargando" message="Buscando tus grupos..." />;
  }
  if (profile && memberships.length === 0 && !activeGroupId) {
    return (
      <>
        <GroupOnboardingPage onCreateGroup={createGroup} onJoinGroup={requestJoinGroup} />
        {loading && <div className="app"><div className="empty-state compact">Cargando...</div></div>}
        {notice && <div className="app"><div className="alert success">{notice}</div></div>}
        {error && <div className="app"><div className="alert error">{error}</div></div>}
      </>
    );
  }

  const preferredPositionShort = currentPlayer?.preferred_position
    ? currentPlayer.preferred_position.substring(0, 3).toUpperCase()
    : "JUG";
  const userRating = ratingMap.get(currentPlayer?.id)?.rating || 70;

  return (
    <div className="app">
      {/* ── SIMULADOR DE ROLES BANNER ── */}
      {isDemoMode && (
        <div style={{
          background: "linear-gradient(90deg, #064e3b, #047857)",
          color: "#ffffff",
          padding: "0.5rem 1rem",
          fontSize: "0.85rem",
          fontWeight: "bold",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
            <span>SIMULADOR DE ROLES: Estás probando como:</span>
            <span style={{
              background: "#ef4444",
              color: "#ffffff",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              textTransform: "uppercase"
            }}>
              {myRole === "super_admin" ? "👑 SUPER ADMIN" : myRole === "admin" ? "📋 ADMIN" : "🏃 JUGADOR"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>Cambiar a:</span>
            <select
              aria-label="Simular Rol"
              value={myRole}
              onChange={(e) => {
                const chosenRole = e.target.value;
                setDevRoleOverride(chosenRole);
                const roleProfileMap = {
                  super_admin: "e62c1146-24be-47a3-83f1-778848d7d001",
                  admin: "e62c1146-24be-47a3-83f1-778848d7d002",
                  player: "e62c1146-24be-47a3-83f1-778848d7d003"
                };
                const profileId = roleProfileMap[chosenRole];
                const matched = profiles.find((p) => p.id === profileId);
                if (matched) setProfile(matched);
              }}
              style={{
                background: "rgba(0,0,0,0.3)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                padding: "2px 8px",
                fontSize: "0.8rem",
                fontWeight: "bold",
                outline: "none"
              }}
            >
              <option value="super_admin">Guille de León (Super Admin)</option>
              <option value="admin">Ale (Admin)</option>
              <option value="player">Javi B (Jugador)</option>
            </select>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="identity-block">
          <img className="topbar-logo" src="/brand/f5manager-logo.jpg" alt="F5Manager" />
          <div className="brand-text">
            <span className="brand-title" style={{ fontSize: "1.25rem", fontWeight: "800", color: "#ffffff", display: "block", lineHeight: "1.1" }}>F5Manager</span>
            <span className="brand-subtitle" style={{ fontSize: "0.65rem", fontWeight: "bold", color: "var(--primary)", display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>Chamuscas Inteligentes</span>
          </div>
        </div>

        {/* Navigation tabs inside header (desktop) */}
        <nav className="tabs top-tabs" aria-label="Principal" style={{ margin: 0, border: "none", gap: "1rem" }}>
          {navItems.map((item) => (
            <button className={classNames("tab", page === item.id && "is-active")}
              key={item.id} type="button" onClick={() => goToPage(item.id)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {item.icon && <span style={{ display: "flex", opacity: 0.8 }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          {memberships.length > 0 && (
            <select aria-label="Grupo activo" className="group-select"
              value={activeGroupId} onChange={(e) => switchGroup(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.group_id} value={m.group_id}>
                  {m.groups?.name || "Chamusca"}
                </option>
              ))}
            </select>
          )}
          
          <div className="desktop-actions-inline">
            <PushNotifications profile={profile} />
            <button className="ghost-button" type="button" onClick={refresh}>Actualizar</button>
          </div>
          
          {/* User profile details on far right */}
          {profile && (
            <div className="user-profile-dropdown-container" style={{ position: "relative", marginLeft: "0.5rem" }}>
              <div 
                className="user-profile-widget" 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.6rem", 
                  cursor: "pointer",
                  padding: "0.25rem",
                  borderRadius: "var(--radius)",
                  background: showProfileMenu ? "rgba(255,255,255,0.1)" : "transparent",
                  transition: "background 0.2s"
                }}
              >
                <div style={{ textAlign: "right" }} className="desktop-only-user-text">
                  <span style={{ fontWeight: "bold", color: "#ffffff", display: "block", fontSize: "0.85rem", lineHeight: "1.2" }}>{displayName(profile)}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.7rem", display: "block" }}>
                    {preferredPositionShort} · OVR {userRating}
                  </span>
                </div>
                <Avatar profile={profile} size={36} />
              </div>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div 
                  className="profile-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    right: 0,
                    background: "var(--surface-1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "var(--radius)",
                    padding: "0.5rem",
                    minWidth: "200px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem"
                  }}
                >
                  <div style={{ padding: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "0.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Tema</span>
                    <ThemeSwitcher />
                  </div>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      refresh();
                    }}
                    style={{ background: "transparent", border: "none", color: "var(--text)", padding: "0.5rem", textAlign: "left", cursor: "pointer", borderRadius: "0.25rem" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "var(--surface-0)"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    className="mobile-only-refresh"
                  >
                    Actualizar Datos
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      signOut();
                    }}
                    style={{ background: "transparent", border: "none", color: "var(--danger)", padding: "0.5rem", textAlign: "left", cursor: "pointer", borderRadius: "0.25rem" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Navigation tabs bottom (mobile) */}
      <nav className="bottom-nav" aria-label="Principal móvil">
        {navItems.map((item) => (
          <button className={classNames("bottom-nav-item", page === item.id && "is-active")}
            key={item.id} type="button" ref={(node) => { mobileNavRefs.current[item.id] = node; }}
            onClick={() => goToPage(item.id)} title={item.label}>
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.mobileLabel || item.label}</span>
          </button>
        ))}
      </nav>

      <SectionHero
        page={page}
        showArtwork={
          page === "team"
            ? myGeneratedTeamsCount > 0
            : page === "sim"
              ? simHasGeneratedTeams
              : true
        }
      />

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {myPendingAssistedReservations.length > 0 && page !== "reservations" && (
        <div className="alert success reservation-alert">
          <span>Tienes reservas pendientes para este período</span>
          <button type="button" onClick={() => goToPage("reservations")}>Ir a reservas</button>
        </div>
      )}
      {loading && <div className="empty-state compact">Cargando...</div>}

      <main>
        {page === "matches" && (
          isSimulating ? (
            <SimPage
              profiles={profiles}
              ratingMap={ratingMap}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              skills={skills}
              onResultChange={setSimHasGeneratedTeams}
              onBack={() => setIsSimulating(false)}
            />
          ) : (
            <MatchesPage
              attendances={attendances}
              fineAmount={lateCancelFineAmount}
              isAdmin={isAdmin}
              matchAttendances={matchAttendances}
              matches={upcomingMatches}
              pastMatches={pastMatches}
              myAttendance={myAttendance}
              nextMatch={nextMatch}
              onCancel={cancelMatch}
              onConfirm={confirmMatch}
              onJoinWaitlist={joinWaitlist}
              onCreateMatch={createMatch}
              onDeleteMatch={deleteMatch}
              onOpenMatch={openMatch}
              profile={currentPlayer}
              teamsByMatch={teamsByMatch}
              venues={venues}
              profiles={profiles}
              groupTags={groupTags}
              onCreateGroupTag={createGroupTag}
              onNotice={setNotice}
              clearance={clearance}
              guests={guests}
              onOpenPizarra={() => setIsSimulating(true)}
            />
          )
        )}
        {page === "match" && selectedMatch && (
          <MatchDetail attendances={matchAttendances(selectedMatch.id)}
            confirmedCount={confirmedAttendances(selectedMatch.id).length + matchGuests.length}
            fineAmount={lateCancelFineAmount} fines={fines} isAdmin={isAdmin}
            match={selectedMatch} myAttendance={myAttendance(selectedMatch.id)}
            onCancel={() => cancelMatch(selectedMatch)}
            onCheckIn={(a) => updateAttendance(a.id, { checked_in: true, status: "checked_in" })}
            onConfirm={() => confirmMatch(selectedMatch)}
            onJoinWaitlist={() => joinWaitlist(selectedMatch)}
            onDeleteMatch={deleteMatch}
            clearance={clearance}
            onGenerateTeams={(opts) => generateTeams(selectedMatch, opts || {})}
            onMarkNoShow={markNoShow}
            onAddGuest={(name, rating) => addGuestPlayer(selectedMatch.id, name, rating)}
            onDeleteGuest={(id) => deleteGuestPlayer(selectedMatch.id, id)}
            onUpdateGuestRating={(id, rating) => updateGuestRating(selectedMatch.id, id, rating)}
            guests={matchGuests}
            profile={currentPlayer} profiles={profiles} profileById={profileById}
            skills={skills} ratingMap={ratingMap}
            teams={teamsByMatch[selectedMatch.id] || []}
            venues={venues}
            matchStats={matchStats}
            onSaveStats={saveMatchStats}
            onBack={() => setPage("matches")} />
        )}
        {page === "team" && (
          <TeamPage matches={sortedMatches} profile={currentPlayer} teamsByMatch={teamsByMatch} isAdmin={isAdmin} ratingMap={ratingMap} skills={skills} matchStats={matchStats} />
        )}
        {page === "leaderboard" && (
          <LeaderboardPage
            profiles={profiles}
            attendances={attendances}
            matchStats={matchStats}
            voteScoreMap={voteScoreMap}
            ratingMap={ratingMap}
            skills={skills}
          />
        )}
        {page === "cashier" && (
          <CashierPage
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            activeGroupId={activeGroupId}
            matches={matches}
            attendances={attendances}
            fines={fines}
            matchFees={matchFees}
            collections={collections}
            expenses={groupExpenses}
            venues={venues}
            onAddExpense={addExpense}
            onDeleteExpense={deleteExpense}
            profile={currentPlayer}
            profileById={profileById}
            profiles={profiles}
            onCreateCollection={createCollection}
            onUpdateCollection={updateCollection}
            onUpdateCollectionPayment={updateCollectionPayment}
            onCloseCollection={closeCollection}
            onDeleteCollection={deleteCollection}
            onUpdateMatchFee={updateMatchFee}
            onUpdateMatchFeePayment={updateMatchFeePayment}
            onReviewProof={reviewProof}
            onForgiveFine={(f) => updateFine(f.id, { status: "forgiven" })}
            onPayFine={(f) => updateFine(f.id, { status: "paid" })}
            onCreateFine={createFine}
          />
        )}
        {page === "profile" && (
          <MyFifaCardPage
            profile={currentPlayer}
            profiles={profiles}
            ratingMap={ratingMap}
            skills={skills}
            matchStats={matchStats}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            activeGroupId={activeGroupId}
            onSaveProfile={saveProfile}
            onAddSkill={addSkill}
            onRemoveSkill={removeSkill}
            onUpdateRole={updateMemberRole}
            onCreateGroup={() => setPage("groups")}
            onDeleteAccount={deleteMyAccount}
            onSignOut={signOut}
          />
        )}
        {page === "groups" && (
          <GroupsPage activeGroupId={activeGroupId} memberships={memberships}
            isAdmin={isAdmin} onCreateGroup={createGroup} onSwitchGroup={switchGroup}
            onUpdateDescription={async (desc) => {
              await api.updateGroupDescription(activeGroupId, desc);
              const rows = await api.listMyGroups(profile.id);
              setMemberships(rows);
              setNotice("Descripción actualizada.");
            }} />
        )}
        {page === "players" && (
          <PlayersPage
            activeGroupId={activeGroupId}
            attendances={attendances}
            fines={fines}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            matches={matches}
            onAssignRating={assignRating}
            onCreateGroupTag={createGroupTag}
            onUpdateMember={updateGroupMember}
            onUpdateProfile={updateProfileAdmin}
            profiles={profiles}
            ratingMap={ratingMap}
            voteScoreMap={voteScoreMap}
            userVoteMap={userVoteMap}
            onVote={votePlayer}
            currentProfileId={profile?.id}
            skills={skills}
            onAddSkill={addSkill}
            onRemoveSkill={removeSkill}
            matchStats={matchStats}
            onUpdateRole={updateMemberRole}
            onNotice={setNotice}
          />
        )}
        {page === "reservations" && (
          <CourtReservationPage
            activeGroupId={activeGroupId}
            profiles={profiles}
            venues={venues}
            matches={sortedMatches}
            attendances={attendances}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            currentUserId={profile?.id}
            onUpdateMatch={editMatch}
            onNotice={setNotice}
            onCreateMatch={(m) => { setMatches((c) => [...c, m]); }}
            onCreateVenue={createVenue}
            onUpdateVenue={updateVenue}
            isDemoMode={isDemoMode}
            reservations={reservations}
            setReservations={setReservations}
          />
        )}
        {page === "tournaments" && isSuperAdmin && (
          <TournamentPage activeGroupId={activeGroupId} profiles={profiles} ratingMap={ratingMap}
            isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} isDemoMode={isDemoMode} />
        )}
        {page === "superadmin" && isSuperAdmin && (
          <SuperAdminPage fines={fines} profiles={profiles} ratingMap={ratingMap}
            settings={settings} onAssignRating={assignRating}
            onUpdateMember={updateGroupMember} onUpdateRole={updateMemberRole}
            onUpdateSettings={updateSettings} onRemoveMember={removeGroupMember} />
        )}
      </main>

      <footer style={{
        textAlign: "center",
        padding: "2rem 1rem",
        paddingBottom: "100px", // space for bottom nav on mobile
        borderTop: "1px solid var(--border)",
        marginTop: "3rem",
        color: "var(--muted)",
        fontSize: "0.85rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem"
      }}>
        <div>© {new Date().getFullYear()} F5Manager</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span>Diseñado y creado por</span>
          <a href="https://innovai.gt" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)", textDecoration: "none", fontWeight: "bold" }}>
            <span style={{ 
              background: "var(--primary)", 
              color: "white", 
              padding: "2px 6px", 
              borderRadius: "4px", 
              fontSize: "0.75rem",
              letterSpacing: "1px" 
            }}>InnovAI</span>
            Gt
          </a>
        </div>
      </footer>

      <AdBanner sticky={true} />

      {showSurveyModal && pendingSurveyMatch && (
        <PostMatchSurveyModal 
          match={pendingSurveyMatch}
          profile={profile}
          activeGroupId={activeGroupId}
          attendances={attendances}
          profiles={profiles}
          onClose={() => {
            localStorage.setItem(`skipped_survey_${pendingSurveyMatch.id}`, 'true');
            setShowSurveyModal(false);
          }}
          onSaveStats={refresh}
          onNotice={setNotice}
          onVote={votePlayer}
          userVoteMap={userVoteMap}
        />
      )}
    </div>
  );
}
