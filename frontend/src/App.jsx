import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import Avatar from "./components/Avatar.jsx";
import PushNotifications from "./components/PushNotifications.jsx";
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
import SectionHero from "./components/SectionHero.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import AuthScreen from "./pages/AuthScreen.jsx";
import FeesPage from "./pages/FeesPage.jsx";
import FinesPage from "./pages/FinesPage.jsx";
import GroupsPage from "./pages/GroupsPage.jsx";
import MatchDetail from "./pages/MatchDetail.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import PlayersAdmin from "./pages/PlayersAdmin.jsx";
import ProfileForm from "./pages/ProfileForm.jsx";
import ProofUploadPage from "./pages/ProofUploadPage.jsx";
import GuestRegisterPage from "./pages/GuestRegisterPage.jsx";
import CourtReservationPage from "./pages/CourtReservationPage.jsx";
import ReservePage from "./pages/ReservePage.jsx";
import SimPage from "./pages/SimPage.jsx";
import SuperAdminPage from "./pages/SuperAdminPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import TournamentPage from "./pages/TournamentPage.jsx";
import VenuesPage from "./pages/VenuesPage.jsx";
import TreasuryPage from "./pages/TreasuryPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
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

export default function App() {
  const [sessionReady, setSessionReady] = useState(!hasSupabaseConfig);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [page, setPage] = useState("matches");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ratings, setRatings] = useState([]);
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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mobileNavRefs = useRef({});

  const activeMembership =
    memberships.find((m) => m.group_id === activeGroupId) || memberships[0] || null;
  const activeGroup = activeMembership?.groups || null;
  const myRole = activeMembership?.role || "player";
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
    { id: "matches", label: "Partidos", mobileLabel: "Partidos" },
    { id: "team", label: "Equipo", mobileLabel: "Equipo" },
    { id: "leaderboard", label: "Estadísticas", mobileLabel: "Estad." },
    { id: "fines", label: "Multas", mobileLabel: "Multas" },
    { id: "fees", label: "Cobros", mobileLabel: "Cobros" },
    { id: "treasury", label: "Finanzas", mobileLabel: "Finan." },
    { id: "profile", label: "Perfil", mobileLabel: "Perfil" },
    { id: "groups", label: "Grupos", mobileLabel: "Grupos" },
    ...(canUseReservationAssistant ? [
      { id: "reservations", label: "Reservas", mobileLabel: "Reservas" },
    ] : []),
    ...(isAdmin ? [
      { id: "admin", label: "Admin", mobileLabel: "Admin" },
      { id: "players", label: "Jugadores", mobileLabel: "Jugad." },
      { id: "venues", label: "Canchas", mobileLabel: "Canchas" },
      { id: "sim", label: "Simular", mobileLabel: "Simular" },
    ] : []),
    ...(isSuperAdmin ? [
      { id: "tournaments", label: "Torneos", mobileLabel: "Torneos" },
      { id: "superadmin", label: "Super Admin", mobileLabel: "Super" },
    ] : []),
  ], [isAdmin, isSuperAdmin]);

  const sortedMatches = useMemo(
    () => [...matches]
      .filter((match) => canAccessMatch(match, currentPlayer, isAdmin))
      .sort((a, b) =>
        `${a.match_date} ${a.start_time}`.localeCompare(`${b.match_date} ${b.start_time}`)
      ), [matches, currentPlayer, isAdmin]
  );
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

  useEffect(() => { if (session?.user) bootstrap(session.user); }, [session?.user?.id]);

  useEffect(() => {
    if (!navItems.some((i) => i.id === page) && page !== "match") setPage("matches");
  }, [navItems, page]);

  useEffect(() => {
    const node = mobileNavRefs.current[page];
    if (!node || typeof window === "undefined" || window.innerWidth > 719) return;
    node.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [page]);

  useEffect(() => {
    if (matches.length === 0 || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get("match");
    if (!sharedMatchId || !matches.some((m) => m.id === sharedMatchId)) return;
    setSelectedMatchId(sharedMatchId);
    setPage("match");
    window.history.replaceState({}, "", window.location.pathname);
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
           statsRows, expensesRows] = await Promise.all([
      api.listMatches(groupId), api.listAttendances(groupId),
      api.listFines(groupId), api.listRatings(groupId),
      api.listSettings(groupId), api.listGroupProfiles(groupId),
      api.listVenues(groupId), api.listCollections(groupId), api.listGroupTags(groupId),
      api.listGroupGuestPlayers(groupId).catch(() => []),
      api.listGroupMatchPlayerStats(groupId).catch(() => []),
      api.listGroupExpenses(groupId).catch(() => []),
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

    const activeIds = (profileRows || [])
      .filter((p) => p && p.membership_is_active)
      .map((p) => p.id);
    await api.syncCollectionPayments(groupId, activeIds);
    const updatedCollections = await api.listCollections(groupId);
    setCollections(updatedCollections);

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
    setLoading(true);
    try { await loadData(profile, groupId); setPage("matches"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function createGroup(name) {
    setNotice(""); setError(""); setLoading(true);
    try {
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
    await supabase.auth.signOut(); setSession(null); resetState();
  }

  async function createMatch(payload) {
    setNotice(""); setError("");
    if (!activeGroupId) { setError("Primero creá o seleccioná un grupo."); return null; }
    try {
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
      const updated = await api.updateMatch(matchId, payload);
      setMatches((c) => c.map((m) => (m.id === updated.id ? updated : m)));
      setNotice("Partido actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function deleteMatch(matchId) {
    setNotice(""); setError("");
    try {
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
      const updated = await api.updateProfileAdmin(profileId, payload);
      setProfiles((c) => c.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      if (updated.id === profile.id) setProfile(updated);
      setNotice("Jugador actualizado.");
    } catch (err) { setError(err.message); }
  }

  async function createGroupTag(name) {
    setNotice(""); setError("");
    try {
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
      await api.updateGroupMember(activeGroupId, profileId, payload);
      const rows = await api.listMyGroups(profile.id);
      setMemberships(rows); await loadData(profile, activeGroupId);
      setNotice("Membresía actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function updateMemberRole(profileId, role) {
    setNotice(""); setError("");
    try {
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
      const guest = await api.addGuestPlayer(matchId, activeGroupId, name, rating, profile.id);
      setGuests((c) => ({ ...c, [matchId]: [...(c[matchId] || []), guest] }));
      setNotice(`${name} agregado como invitado.`);
    } catch (err) { setError(err.message); }
  }

  async function deleteGuestPlayer(matchId, guestId) {
    setNotice(""); setError("");
    try {
      await api.deleteGuestPlayer(guestId);
      setGuests((c) => ({ ...c, [matchId]: (c[matchId] || []).filter((g) => g.id !== guestId) }));
      setNotice("Invitado eliminado.");
    } catch (err) { setError(err.message); }
  }

  async function updateGuestRating(matchId, guestId, rating) {
    try {
      const updated = await api.updateGuestPlayer(guestId, { rating });
      setGuests((c) => ({ ...c, [matchId]: (c[matchId] || []).map((g) => g.id === guestId ? updated : g) }));
    } catch (err) { setError(err.message); }
  }

  async function saveMatchStats(matchId, statsArray) {
    if (!profile) return;
    try {
      setError(null);
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
      await api.deleteGroupExpense(expenseId);
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
      await api.removePlayerSkill(skillId);
      setSkills((c) => c.filter((s) => s.id !== skillId));
    } catch (err) {
      console.error("Error removing skill:", err);
      setError(err.message);
      alert("Error al quitar habilidad: " + err.message);
    }
  }

  async function updateAttendance(attendanceId, payload) {
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
      const fine = await api.createFine({
        group_id: activeGroupId, profile_id: attendance.profile_id,
        match_id: attendance.match_id, reason: "no_show",
        amount: settings?.fine_amount || 50, status: "open",
      });
      setFines((c) => [fine, ...c]);
      setNotice(`${displayName(profileById.get(updated.profile_id))} marcado como no llegó.`);
    } catch (err) { setError(err.message); }
  }

  async function updateFine(fineId, payload) {
    setNotice(""); setError("");
    try {
      const updated = await api.updateFine(fineId, payload);
      setFines((c) => c.map((f) => (f.id === updated.id ? updated : f)));
      setNotice("Multa actualizada.");
    } catch (err) { setError(err.message); }
  }

  async function createFine(payload) {
    setNotice(""); setError("");
    try {
      const fine = await api.createFine(payload);
      setFines((c) => [fine, ...c]);
      setNotice("Multa creada.");
      return fine;
    } catch (err) { setError(err.message); }
  }

  async function createVenue(payload, photoFile) {
    setNotice(""); setError("");
    try {
      let venue = await api.createVenue(payload);
      if (photoFile) venue = await api.uploadVenuePhoto(venue.id, photoFile);
      setVenues((c) => [...c, venue]);
      setNotice("Cancha agregada al catálogo.");
    } catch (err) { setError(err.message); }
  }

  async function updateVenue(venueId, payload, photoFile) {
    setNotice(""); setError("");
    try {
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
      await api.updateCollection(collectionId, { status: "closed" });
      setCollections((c) => c.map((col) =>
        col.id === collectionId ? { ...col, status: "closed" } : col
      ));
      setNotice("Colaboración cerrada.");
    } catch (err) { setError(err.message); }
  }

  async function deleteCollection(collectionId) {
    setNotice(""); setError("");
    try {
      await api.deleteCollection(collectionId);
      setCollections((c) => c.filter((col) => col.id !== collectionId));
      setNotice("Colaboración eliminada.");
    } catch (err) { setError(err.message); }
  }

  async function updateMatchFeePayment(paymentId, payload) {
    setNotice(""); setError("");
    try {
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
      const updated = await api.updateSettings(activeGroupId, payload);
      setSettings(updated);
      setNotice("Configuración guardada.");
    } catch (err) { setError(err.message); }
  }

  async function removeGroupMember(profileId) {
    setNotice(""); setError("");
    try {
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

  // Render proof upload page (no auth required, but page handles login check)
  if (proofToken) {
    return <ProofUploadPage token={proofToken} session={session} />;
  }

  // Render guards
  if (!hasSupabaseConfig) return <ConfigMissing />;
  if (!sessionReady) return <ShellMessage title="Cargando" message="Revisando tu sesión..." />;
  if (!session) return <AuthScreen />;
  if (loading && !profile) return <ShellMessage title="Cargando" message="Preparando tu perfil..." />;
  if (profile && !profileComplete(profile)) {
    return (
      <div className="app auth-shell">
        <ProfileForm initialProfile={profile} mode="complete" onSave={saveProfile} onSignOut={signOut} />
      </div>
    );
  }

  const myRoleDisplay = isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Jugador activo";

  return (
    <div className="app">
      <header className="topbar">
        <div className="identity-block">
          <img className="topbar-logo" src="/brand/f5manager-logo.jpg" alt="F5Manager" />
          <div>
            <h1>{displayName(profile)}</h1>
            <small>
              {activeGroup
                ? `${activeGroup.name} · ${isActiveMember ? myRoleDisplay : "Pendiente"}`
                : "Sin grupo"}
            </small>
          </div>
        </div>
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
          <ThemeSwitcher />
          <PushNotifications profile={profile} />
          <button className="ghost-button" type="button" onClick={refresh}>Actualizar</button>
          <button className="secondary-button" type="button" onClick={signOut}>Salir</button>
        </div>
      </header>

      <nav className="tabs top-tabs" aria-label="Principal">
        {navItems.map((item) => (
          <button className={classNames("tab", page === item.id && "is-active")}
            key={item.id} type="button" onClick={() => setPage(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <nav className="bottom-nav" aria-label="Principal móvil">
        {navItems.map((item) => (
          <button className={classNames("bottom-nav-item", page === item.id && "is-active")}
            key={item.id} type="button" ref={(node) => { mobileNavRefs.current[item.id] = node; }}
            onClick={() => setPage(item.id)} title={item.label}>
            {item.mobileLabel || item.label}
          </button>
        ))}
      </nav>

      <SectionHero page={page} />

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {myPendingAssistedReservations.length > 0 && page !== "reservations" && (
        <div className="alert success reservation-alert">
          <span>Tienes reservas pendientes para este período</span>
          <button type="button" onClick={() => setPage("reservations")}>Ir a reservas</button>
        </div>
      )}
      {loading && <div className="empty-state compact">Cargando...</div>}

      <main>
        {page === "matches" && (
          <MatchesPage attendances={attendances} fineAmount={lateCancelFineAmount}
            isAdmin={isAdmin} matchAttendances={matchAttendances} matches={upcomingMatches}
            pastMatches={pastMatches}
            myAttendance={myAttendance} nextMatch={nextMatch}
            onCancel={cancelMatch} onConfirm={confirmMatch} onJoinWaitlist={joinWaitlist}
            onCreateMatch={createMatch} onDeleteMatch={deleteMatch}
            onOpenMatch={openMatch} profile={currentPlayer} teamsByMatch={teamsByMatch}
            venues={venues} profiles={profiles} groupTags={groupTags}
            onCreateGroupTag={createGroupTag}
            onNotice={setNotice}
            clearance={clearance}
            guests={guests} />
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
            onSaveStats={saveMatchStats} />
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
        {page === "fines" && (
          <FinesPage fines={fines} isAdmin={isAdmin} matches={matches}
            onForgive={(f) => updateFine(f.id, { status: "forgiven" })}
            onPay={(f) => updateFine(f.id, { status: "paid" })}
            onCreateFine={createFine}
            profileById={profileById} profile={currentPlayer}
            profiles={profiles} activeGroupId={activeGroupId} />
        )}
        {page === "fees" && (
          <FeesPage collections={collections} isAdmin={isAdmin} matchFees={matchFees}
            matches={matches} profile={currentPlayer} profileById={profileById}
            onCreateCollection={createCollection}
            onUpdateCollectionPayment={updateCollectionPayment}
            onCloseCollection={closeCollection}
            onDeleteCollection={deleteCollection}
            onUpdateMatchFeePayment={updateMatchFeePayment}
            onReviewProof={reviewProof} />
        )}
        {page === "treasury" && (
          <TreasuryPage
            isAdmin={isAdmin}
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
          />
        )}
        {page === "profile" && (
          <div className="page-grid">
            <ProfileForm
              initialProfile={profile}
              mode="edit"
              onSave={saveProfile}
              onDeleteAccount={deleteMyAccount}
              ratingMap={ratingMap}
            />
          </div>
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
        {page === "admin" && isAdmin && (
          <AdminPanel matches={sortedMatches} venues={venues}
            profiles={profiles} attendances={attendances}
            onCreateMatch={createMatch} onDeleteMatch={deleteMatch}
            onEditMatch={editMatch} onGenerateTeams={generateTeams}
            teamsByMatch={teamsByMatch} groupTags={groupTags}
            onCreateGroupTag={createGroupTag}
            onNotice={setNotice} />
        )}
        {page === "players" && isAdmin && (
          <PlayersAdmin activeGroupId={activeGroupId} attendances={attendances} fines={fines} matches={matches}
            onAssignRating={isSuperAdmin ? assignRating : undefined}
            onUpdateMember={updateGroupMember} onUpdateProfile={updateProfileAdmin}
            onCreateGroupTag={createGroupTag}
            profiles={profiles} ratingMap={ratingMap} isSuperAdmin={isSuperAdmin}
            voteScoreMap={voteScoreMap} userVoteMap={userVoteMap} onVote={votePlayer}
            currentProfileId={profile?.id}
            skills={skills} onAddSkill={addSkill} onRemoveSkill={removeSkill}
            matchStats={matchStats} />
        )}
        {page === "venues" && isAdmin && (
          <VenuesPage groupId={activeGroupId} profileId={profile?.id} venues={venues} matches={matches}
            onCreateVenue={createVenue} onUpdateVenue={updateVenue} />
        )}
        {page === "reservations" && canUseReservationAssistant && (
          <CourtReservationPage activeGroupId={activeGroupId} profiles={profiles}
            venues={venues} matches={sortedMatches} attendances={attendances}
            isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
            currentUserId={profile?.id}
            onUpdateMatch={editMatch}
            onNotice={setNotice}
            onCreateMatch={(m) => { setMatches((c) => [...c, m]); }} />
        )}
        {page === "sim" && isAdmin && (
          <SimPage profiles={profiles} ratingMap={ratingMap} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} skills={skills} />
        )}
        {page === "tournaments" && isSuperAdmin && (
          <TournamentPage activeGroupId={activeGroupId} profiles={profiles} ratingMap={ratingMap}
            isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
        )}
        {page === "superadmin" && isSuperAdmin && (
          <SuperAdminPage fines={fines} profiles={profiles} ratingMap={ratingMap}
            settings={settings} onAssignRating={assignRating}
            onUpdateMember={updateGroupMember} onUpdateRole={updateMemberRole}
            onUpdateSettings={updateSettings} onRemoveMember={removeGroupMember} />
        )}
      </main>
    </div>
  );
}
