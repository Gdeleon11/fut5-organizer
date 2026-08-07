import React from "react";
import { Tabs } from "../ui/Tabs.jsx";
import { Calendar, Users, Shield } from "lucide-react";

/**
 * F5Manager MatchTabs Component
 */
export function MatchTabs({
  activeTab,
  onTabChange,
  confirmedCount,
  teamsCount,
}) {
  const tabList = [
    {
      id: "partido",
      label: "Partido",
      icon: <Calendar size={16} />
    },
    {
      id: "jugadores",
      label: "Jugadores",
      icon: <Users size={16} />,
      badge: confirmedCount
    },
    {
      id: "equipos",
      label: "Equipos",
      icon: <Shield size={16} />,
      badge: teamsCount || 0
    }
  ];

  return (
    <Tabs
      tabs={tabList}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
}

export default MatchTabs;
