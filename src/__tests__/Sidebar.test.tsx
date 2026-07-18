import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Sidebar } from "../components/layout/Sidebar";
import { useI18nStore } from "../store/i18nStore";
import { _resetBatchQueue, useMaintenanceStore } from "../store/maintenanceStore";
import { useProfileStore } from "../store/profileStore";
import { useUiStore } from "../store/uiStore";
import type { ServerProfile } from "../types";

const profile: ServerProfile = {
  id: "profile-1",
  name: "Production SQL",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "secret",
  encrypt: false,
  trust_server_certificate: true,
  environment: "production",
};

describe("Sidebar", () => {
  beforeEach(() => {
    _resetBatchQueue();
    useI18nStore.setState({ lang: "en" });
    useProfileStore.setState({ profiles: [profile], loading: false });
    useUiStore.setState({
      currentView: "dashboard",
      activeProfileId: profile.id,
      profileViews: { [profile.id]: "dashboard" },
      connectedProfileIds: [profile.id],
    });
    useMaintenanceStore.setState({ byProfile: {} });
    useMaintenanceStore.getState().startRun(profile, ["db_main"], false);
  });

  it("announces compact profile run state and provides a usable close target", () => {
    render(<Sidebar />);

    expect(
      screen.getByRole("button", { name: "Production SQL · running" }),
    ).toBeInTheDocument();

    const closeButton = screen
      .getAllByRole("button", { name: /Cannot close while run is active/i })
      .find((button) => button.classList.contains("h-6"));

    expect(closeButton).toHaveClass("h-6", "w-6");
  });
});
