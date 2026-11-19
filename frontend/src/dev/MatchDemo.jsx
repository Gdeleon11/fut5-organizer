import { useState } from "react";
import { AppearanceScope } from "../appearance/AppearanceProvider.jsx";
import SimPage from "../pages/SimPage.jsx";
import PostMatchSurveyModal from "../components/PostMatchSurveyModal.jsx";

const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const profiles = Array.from({ length: 18 }, (_, i) => ({
  id: "demo-" + i, nickname: "Jugador " + (i + 1),
  preferred_position: positions[i % positions.length], membership_is_active: true,
}));
const match = { id: "demo-match", title: "Partido de práctica" };
const attendances = profiles.map(p => ({ match_id: match.id, profile_id: p.id, status: "confirmed" }));
const ratings = new Map();

export default function MatchDemo() {
  const [survey, setSurvey] = useState(false);
  const [votes, setVotes] = useState(new Map());
  const [notice, setNotice] = useState("");
  return <main>
    <AppearanceScope />
    <button onClick={() => setSurvey(true)}>Abrir encuesta de práctica</button>
    <p role="status">{notice}</p>
    <SimPage profiles={profiles} ratingMap={ratings} isAdmin isSuperAdmin />
    {survey && <PostMatchSurveyModal match={match} profile={profiles[0]} profiles={profiles}
      attendances={attendances} userVoteMap={votes} savePlayerStats={async () => {}}
      onVote={(id, value) => setVotes(prev => new Map(prev).set(id, value))}
      onNotice={setNotice} onClose={() => setSurvey(false)} />}
  </main>;
}
