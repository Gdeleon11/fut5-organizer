import { useState } from "react";
import TreasuryPage from "./TreasuryPage.jsx";
import FeesPage from "./FeesPage.jsx";
import FinesPage from "./FinesPage.jsx";

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
  const [activeTab, setActiveTab] = useState("treasury"); // "treasury" | "fees" | "fines"

  return (
    <div className="cashier-page">
      <div className="tab-row" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`tab-button ${activeTab === "treasury" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("treasury")}
        >
          📊 Caja y Finanzas
        </button>
        <button
          className={`tab-button ${activeTab === "fees" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("fees")}
        >
          💰 Cobros y Cuotas
        </button>
        <button
          className={`tab-button ${activeTab === "fines" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("fines")}
        >
          ⚠️ Multas
        </button>
      </div>

      {activeTab === "treasury" && (
        <TreasuryPage
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
  );
}
