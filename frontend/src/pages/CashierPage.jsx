import { useMemo, useState } from "react";
import { AlertTriangle, Landmark, Receipt, Wallet } from "lucide-react";
import TreasuryPage from "./TreasuryPage.jsx";
import FeesPage from "./FeesPage.jsx";
import FinesPage from "./FinesPage.jsx";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { Money } from "../components/finance/FinanceBlocks.jsx";
import { myPendingDebts, treasurySummary, visibleFinesFor } from "../finance/financeModel.js";

const TABS = [
  ["treasury", "Caja y finanzas", Landmark],
  ["fees", "Cobros y cuotas", Wallet],
  ["fines", "Multas", AlertTriangle],
];

export default function CashierPage({
  isAdmin,
  isSuperAdmin,
  activeGroupId,
  matches,
  attendances,
  fines,
  matchFees,
  collections,
  expenses,
  venues,
  onAddExpense,
  onDeleteExpense,
  profile,
  profileById,
  profiles,
  onCreateCollection,
  onUpdateCollection,
  onUpdateCollectionPayment,
  onCloseCollection,
  onDeleteCollection,
  onUpdateMatchFee,
  onUpdateMatchFeePayment,
  onReviewProof,
  onForgiveFine,
  onPayFine,
  onCreateFine,
}) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const [activeTab, setActiveTab] = useState("treasury"); // "treasury" | "fees" | "fines"

  const summary = useMemo(
    () => treasurySummary({ fines: fines || [], matchFees: matchFees || [], collections: collections || [], expenses: expenses || [], matches: matches || [] }),
    [fines, matchFees, collections, expenses, matches],
  );

  // Tab badges: admins see proofs waiting for review; players see their own pending items.
  const badges = useMemo(() => {
    const allPayments = [
      ...(matchFees || []).flatMap((f) => f.match_fee_payments || []),
      ...(collections || []).flatMap((c) => c.collection_payments || []),
    ];
    const toReview = allPayments.filter((p) => p.proof_url && p.proof_status === "submitted").length;
    const mine = profile ? myPendingDebts({ matchFees: matchFees || [], collections: collections || [], matches: matches || [], profileId: profile.id }) : null;
    const openFines = visibleFinesFor({ fines: fines || [], isAdmin, profileId: profile?.id }).filter((f) => f.status === "open").length;
    return {
      fees: isAdmin ? toReview : (mine ? mine.myMatchDebts.length + mine.myCollectionDebts.length : 0),
      fines: openFines,
      toReview,
      myDebt: mine?.totalDebt || 0,
    };
  }, [collections, fines, isAdmin, matchFees, matches, profile]);

  const balanceTone = summary.currentBalance >= 0 ? "good" : "bad";

  return (
    <div className={`md-matches md-design-${variant} fx-page`} data-design={variant} data-view="cashier">
      <div className={variant === "command" ? "mdc fx-shell" : "mde fx-shell"}>
        {variant === "command" ? (
          <div className="mdc-bar fx-cc-bar">
            <h1>Cobros</h1>
            <span className="mdc-pill"><Landmark size={14} aria-hidden="true" /> Saldo <b><Money value={summary.currentBalance} tone={balanceTone} /></b></span>
            <span className="mdc-pill"><Wallet size={14} aria-hidden="true" /> Por cobrar <b><Money value={summary.pendingReceivables} /></b></span>
            {isAdmin
              ? <span className={`mdc-pill ${badges.toReview ? "fx-pill-warn" : ""}`}><Receipt size={14} aria-hidden="true" /> <b>{badges.toReview}</b> por revisar</span>
              : <span className={`mdc-pill ${badges.myDebt ? "fx-pill-warn" : ""}`}><Receipt size={14} aria-hidden="true" /> Mi saldo <b><Money value={badges.myDebt} /></b></span>}
          </div>
        ) : (
          <header className="fx-ed-hero">
            <span className="mde-crumb">Caja del grupo</span>
            <h1>Cobros</h1>
            <p className="fx-ed-lede">
              Saldo disponible <Money value={summary.currentBalance} tone={balanceTone} className="fx-lede-num" />
              <span aria-hidden="true"> · </span>
              por cobrar <Money value={summary.pendingReceivables} className="fx-lede-num" />
              {!isAdmin && badges.myDebt > 0 && (<><span aria-hidden="true"> · </span>tu saldo pendiente <Money value={badges.myDebt} tone="warn" className="fx-lede-num" /></>)}
            </p>
          </header>
        )}

        <nav className="pl-tabs fx-tabs" aria-label="Secciones de Cobros">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} type="button" className={activeTab === id ? "is-on" : ""} aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)}>
              <Icon size={16} aria-hidden="true" /> {label}
              {badges[id] > 0 && <span className="fx-tab-badge" aria-label={`${badges[id]} pendientes`}>{badges[id]}</span>}
            </button>
          ))}
        </nav>

        {activeTab === "treasury" && (
          <TreasuryPage
            variant={variant}
            summary={summary}
            isAdmin={isAdmin}
            activeGroupId={activeGroupId}
            matches={matches}
            attendances={attendances}
            fines={fines}
            matchFees={matchFees}
            collections={collections}
            expenses={expenses}
            venues={venues}
            onAddExpense={onAddExpense}
            onDeleteExpense={onDeleteExpense}
            profile={profile}
          />
        )}

        {activeTab === "fees" && (
          <FeesPage
            variant={variant}
            collections={collections}
            isAdmin={isAdmin}
            matchFees={matchFees}
            matches={matches}
            profile={profile}
            profileById={profileById}
            onCreateCollection={onCreateCollection}
            onUpdateCollection={onUpdateCollection}
            onUpdateCollectionPayment={onUpdateCollectionPayment}
            onCloseCollection={onCloseCollection}
            onDeleteCollection={onDeleteCollection}
            onUpdateMatchFee={onUpdateMatchFee}
            onUpdateMatchFeePayment={onUpdateMatchFeePayment}
            onReviewProof={onReviewProof}
          />
        )}

        {activeTab === "fines" && (
          <FinesPage
            variant={variant}
            fines={fines}
            isAdmin={isAdmin}
            matches={matches}
            onForgive={onForgiveFine}
            onPay={onPayFine}
            onCreateFine={onCreateFine}
            profileById={profileById}
            profile={profile}
            profiles={profiles}
            activeGroupId={activeGroupId}
          />
        )}
      </div>
    </div>
  );
}
