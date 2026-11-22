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
const ratings = new Map();
// In-memory postmatch (DEV demo only): everyone in the lineup, nothing persisted.
const demoPostmatch = () => {
  const state = { participants: profiles.map((p) => p.id), events: [], corrections: [], history: [], mvp: { participants: 18, voters: 0, quorum: 9, leaders: [] }, my_vote: null, closed: null };
  return {
    postmatchSummary: async () => ({ ...state }),
    postmatchReport: async (_m, subject_id, kind, quantity) => { state.events = [...state.events.filter((e) => !(e.subject_id === subject_id && e.kind === kind)), { id: `${subject_id}-${kind}`, subject_id, kind, quantity, status: "provisional" }]; return {}; },
    postmatchVoteMvp: async (_m, id) => { state.my_vote = id; return {}; },
  };
};

export default function MatchDemo() {
  const [survey, setSurvey] = useState(false);
  const [pm] = useState(demoPostmatch);
  const [notice, setNotice] = useState("");
  return <main>
    <AppearanceScope />
    <button onClick={() => setSurvey(true)}>Abrir encuesta de práctica</button>
    <p role="status">{notice}</p>
    <SimPage profiles={profiles} ratingMap={ratings} isAdmin isSuperAdmin />
    {survey && <PostMatchSurveyModal match={match} profile={profiles[0]} profiles={profiles}
      postmatchApi={pm} onNotice={setNotice} onClose={() => setSurvey(false)} />}
  </main>;
}
