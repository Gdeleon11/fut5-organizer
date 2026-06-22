import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import Avatar from "./components/Avatar.jsx";
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
import SimPage from "./pages/SimPage.jsx";
import SuperAdminPage from "./pages/SuperAdminPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import TournamentPage from "./pages/TournamentPage.jsx";
import VenuesPage from "./pages/VenuesPage.jsx";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";
import { classNames, displayName, profileComplete, roleLabel } from "./utils.js";

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
        <p className="eyebrow">fut5-organizer</p>
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
  const [settings, setSettings] = useState(null);
  const [venues, setVenues] = useState([]);
  const [matchFees, setMatchFees] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeMembership =
    memberships.find((m) => m.group_id === activeGroupId) || memberships[0] || null;
  const activeGroup = activeMembership?.groups || null;
  const myRole = activeMembership?.role || "player";
  const isSuperAdmin = myRole === "super_admin";
  const isAdmin = myRole === "admin" || isSuperAdmin;
  const isActiveMember = Boolean(activeMembership?.is_active);
  const currentPlayer = profile ? { ...profile, is_active: isActiveMember } : profile;
  const ratingMap = useMemo(() => api.latestRatingsByProfile(ratings), [ratings]);
  const lateCancelFineAmount = settings?.late_cancel_fine_amount ?? 25;

  const navItems = useMemo(() => [
    { id: "matches", label: "Partidos" },
    { id: "team", label: "Equipo" },
    { id: "fines", label: "Multas" },
    { id: "fees", label: "Cobros" },
    { id: "profile", label: "Perfil" },
    { id: "groups", label: "Grupos" },
    ...(isAdmin ? [
      { id: "admin", label: "Admin" },
      { id: "players", label: "Jugadores" },
      { id: "venues", label: "Canchas" },
      { id: "sim", label: "Simular" },
    ] : []),
    ...(isSuperAdmin ? [
      { id: "tournaments", label: "Torneos" },
      { id: "superadmin", label: "Super Admin" },
    ] : []),
  ], [isAdmin, isSuperAdmin]);

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) =>
      `${a.match_date} ${a.start_time}`.localeCompare(`${b.match_date} ${b.start_time}`)
    ), [matches]
  );
  const upcomingMatches = useMemo(
    () => sortedMatches.filter((m) => m.status !== "closed"), [sortedMatches]
  );
  const nextMatch = upcomingMatches[0] || sortedMatches[0] || null;
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || nextMatch;
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])), [profiles]
  );

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
    if (matches.length === 0 || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get("match");
    if (!sharedMatchId || !matches.some((m) => m.id === sharedMatchId)) return;
    setSelectedMatchId(sharedMatchId);
    setPage("match");
    window.history.replaceState({}, "", window.location.pathname);
  }, [matches]);

  function resetState() {
    setProfile(null); setMemberships([]); setActiveGroupId("");
    setProfiles([]); setRatings([]); setMatches([]); setAttendances([]);
    setTeamsByMatch({}); setFines([]); setSettings(null);
    setVenues([]); setMatchFees([]); setCollections([]);
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
           profileRows, venueRows, collectionRows] = await Promise.all([
      api.listMatches(groupId), api.listAttendances(groupId),
      api.listFines(groupId), api.listRatings(groupId),
      api.listSettings(groupId), api.listGroupProfiles(groupId),
      api.listVenues(groupId), api.listCollections(groupId),
    ]);
    const teamsMap = await api.listAllTeams(matchRows);
    // Load match fees for all matches that have a court cost
    const feePairs = await Promise.all(
      matchRows.filter((m) => Number(m.court_cost) > 0)
        .map(async (m) => api.getMatchFee(m.id))
    );
    setMatches(matchRows); setAttendances(attendanceRows); setFines(fineRows);
    setRatings(ratingRows); setSettings(settingRows[0] || null);
    setProfiles(profileRows); setTeamsByMatch(teamsMap);
    setVenues(venueRows); setCollections(collectionRows);
    setMatchFees(feePairs.filter(Boolean));

    const activeIds = profileRows
      .filter((p) => p.membership_is_active)
      .map((p) => p.id);
    await api.syncCollectionPayments(groupId, activeIds);
    const updatedCollections = await api.listCollections(groupId);
    setCollections(updatedCollections);
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
    if (!isActiveMember) {
      setError("Tu membresía está inactiva. Pedile a un admin que te active."); return;
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
      const { attendance: updated, fine } = await api.cancelAttendance(
        attendance.id, activeGroupId, profile.id, match.id, lateCancelFineAmount
      );
      setAttendances((c) => c.map((a) => (a.id === updated.id ? updated : a)));
      setFines((c) => [fine, ...c]);
      setNotice(`Asistencia cancelada. Multa de Q${lateCancelFineAmount} generada.`);
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

  async function createMatch(payload, courtPhotoFile) {
    setNotice(""); setError("");
    if (!activeGroupId) { setError("Primero creá o seleccioná un grupo."); return null; }
    try {
      let created = await api.createMatch({ ...payload, group_id: activeGroupId });
      if (courtPhotoFile) created = await api.uploadMatchPhoto(created.id, courtPhotoFile);
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

  async function uploadMatchPhoto(matchId, file) {
    setNotice(""); setError("");
    try {
      const updated = await api.uploadMatchPhoto(matchId, file);
      setMatches((c) => c.map((m) => (m.id === updated.id ? updated : m)));
      setNotice("Foto de cancha guardada.");
    } catch (err) { setError(err.message); }
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
      setProfiles((c) => c.map((p) => (p.id === updated.id ? updated : p)));
      if (updated.id === profile.id) setProfile(updated);
      setNotice("Jugador actualizado.");
    } catch (err) { setError(err.message); }
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

  async function generateTeams(match) {
    setNotice(""); setError("");
    try {
      const result = await api.generateTeamsForMatch(match, profiles, attendances, ratings);
      setTeamsByMatch((c) => ({ ...c, [match.id]: result.teams }));
      setNotice("Equipos generados.");
    } catch (err) { setError(err.message); }
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
          <Avatar profile={profile} size="lg" />
          <div>
            <p className="eyebrow">fut5-organizer</p>
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
            key={item.id} type="button" onClick={() => setPage(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {loading && <div className="empty-state compact">Cargando...</div>}

      <main>
        {page === "matches" && (
          <MatchesPage attendances={attendances} fineAmount={lateCancelFineAmount}
            isAdmin={isAdmin} matchAttendances={matchAttendances} matches={upcomingMatches}
            myAttendance={myAttendance} nextMatch={nextMatch}
            onCancel={cancelMatch} onConfirm={confirmMatch}
            onCreateMatch={createMatch} onDeleteMatch={deleteMatch}
            onOpenMatch={openMatch} profile={currentPlayer} teamsByMatch={teamsByMatch}
            venues={venues} />
        )}
        {page === "match" && selectedMatch && (
          <MatchDetail attendances={matchAttendances(selectedMatch.id)}
            confirmedCount={confirmedAttendances(selectedMatch.id).length}
            fineAmount={lateCancelFineAmount} fines={fines} isAdmin={isAdmin}
            match={selectedMatch} myAttendance={myAttendance(selectedMatch.id)}
            onCancel={() => cancelMatch(selectedMatch)}
            onCheckIn={(a) => updateAttendance(a.id, { checked_in: true, status: "checked_in" })}
            onConfirm={() => confirmMatch(selectedMatch)}
            onDeleteMatch={deleteMatch}
            onGenerateTeams={() => generateTeams(selectedMatch)}
            onMarkNoShow={markNoShow}
            onUploadMatchPhoto={(file) => uploadMatchPhoto(selectedMatch.id, file)}
            profile={currentPlayer} profileById={profileById}
            teams={teamsByMatch[selectedMatch.id] || []} />
        )}
        {page === "team" && (
          <TeamPage matches={sortedMatches} profile={currentPlayer} teamsByMatch={teamsByMatch} />
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
            onCreateGroup={createGroup} onSwitchGroup={switchGroup} />
        )}
        {page === "admin" && isAdmin && (
          <AdminPanel matches={sortedMatches} venues={venues}
            onCreateMatch={createMatch} onDeleteMatch={deleteMatch}
            onEditMatch={editMatch} onGenerateTeams={generateTeams}
            onUploadMatchPhoto={uploadMatchPhoto} teamsByMatch={teamsByMatch} />
        )}
        {page === "players" && isAdmin && (
          <PlayersAdmin activeGroupId={activeGroupId} attendances={attendances} fines={fines} matches={matches}
            onAssignRating={isSuperAdmin ? assignRating : undefined}
            onUpdateMember={updateGroupMember} onUpdateProfile={updateProfileAdmin}
            profiles={profiles} ratingMap={ratingMap} isSuperAdmin={isSuperAdmin} />
        )}
        {page === "venues" && isAdmin && (
          <VenuesPage groupId={activeGroupId} profileId={profile?.id} venues={venues}
            onCreateVenue={createVenue} onUpdateVenue={updateVenue} />
        )}
        {page === "sim" && isAdmin && (
          <SimPage profiles={profiles} ratingMap={ratingMap} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
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
