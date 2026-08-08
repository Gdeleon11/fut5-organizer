import React from "react";
import DesktopNav from "./DesktopNav.jsx";
import GroupSwitcher from "./GroupSwitcher.jsx";
import UserMenu from "./UserMenu.jsx";
import PushNotifications from "../PushNotifications.jsx";

/**
 * F5Manager AppHeader Component (Top Bar for Desktop & Mobile)
 */
export function AppHeader({
  navItems = [],
  activePage,
  goToPage,
  memberships = [],
  activeGroupId,
  switchGroup,
  profile,
  preferredPositionShort,
  userRating,
  refresh,
  signOut,
}) {
  return (
    <header className="f5-app-header">
      {/* Brand Identity */}
      <div
        className="f5-brand"
        onClick={() => goToPage("matches")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") goToPage("matches"); }}
      >
        <img
          className="f5-brand-logo"
          src="/brand/f5manager-logo.jpg"
          alt="F5Manager"
        />
        <div className="f5-brand-text">
          <span className="f5-brand-name">F5Manager</span>
          <span className="f5-brand-sub">Chamuscas Inteligentes</span>
        </div>
      </div>

      {/* Primary Desktop Navigation Tabs */}
      <DesktopNav
        navItems={navItems}
        activePage={activePage}
        goToPage={goToPage}
      />

      {/* Right-aligned Actions */}
      <div className="f5-shell-actions">
        {/* Active Group Selector */}
        <GroupSwitcher
          memberships={memberships}
          activeGroupId={activeGroupId}
          switchGroup={switchGroup}
        />

        {/* Notifications Icon */}
        <PushNotifications profile={profile} />

        {/* User Menu Trigger & Dropdown */}
        <UserMenu
          profile={profile}
          preferredPositionShort={preferredPositionShort}
          userRating={userRating}
          refresh={refresh}
          signOut={signOut}
          goToPage={goToPage}
        />
      </div>
    </header>
  );
}

export default AppHeader;
