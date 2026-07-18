import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MaintenanceDashboard } from "../components/dashboard/MaintenanceDashboard";
import { useI18nStore } from "../store/i18nStore";
import { _resetBatchQueue, useMaintenanceStore } from "../store/maintenanceStore";
import { useUiStore } from "../store/uiStore";
import type { IndexDetail, ServerProfile } from "../types";

const profile: ServerProfile = {
  id: "profile-1",
  name: "Production",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "secret",
  encrypt: false,
  trust_server_certificate: true,
  environment: "production",
};

const secondProfile: ServerProfile = {
  ...profile,
  id: "profile-2",
  name: "Reporting",
  server: "reporting.example.local",
};

function index(indexName: string): IndexDetail {
  return {
    database_name: "db_active",
    schema_name: "dbo",
    table_name: "Orders",
    index_name: indexName,
    fragmentation_percent: 42,
    page_count: 100,
    status: "processing",
    action: "REBUILD",
  };
}

describe("MaintenanceDashboard", () => {
  beforeEach(() => {
    _resetBatchQueue();
    useI18nStore.setState({ lang: "en" });
    useUiStore.setState({
      currentView: "dashboard",
      activeProfileId: profile.id,
      profileViews: { [profile.id]: "dashboard" },
      connectedProfileIds: [profile.id],
    });
    useMaintenanceStore.setState({ byProfile: {} });
    useMaintenanceStore.getState().startRun(profile, ["db_active", "db_failed"], true);

    const run = useMaintenanceStore.getState().byProfile[profile.id];
    useMaintenanceStore.setState({
      byProfile: {
        [profile.id]: {
          ...run,
          databases: [
            {
              ...run.databases[0],
              state: "running",
              indexes: [index("IX_Orders_Date"), index("IX_Orders_Customer")],
              indexes_processed: 1,
            },
            {
              ...run.databases[1],
              state: "error",
              errors: ["Deadlock while rebuilding index"],
            },
          ],
        },
      },
    });
  });

  it("jumps from the failure notice to the needs-attention view", async () => {
    const user = userEvent.setup();

    render(<MaintenanceDashboard />);

    expect(screen.getByText("db_active")).toBeInTheDocument();
    expect(screen.getByText("db_failed")).toBeInTheDocument();
    expect(screen.getByText("1 database(s) need attention.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Review failures/i }));

    expect(screen.queryByText("db_active")).not.toBeInTheDocument();
    expect(screen.getByText("db_failed")).toBeInTheDocument();
  });

  it("resets the dashboard focus when switching profiles", async () => {
    const user = userEvent.setup();

    render(<MaintenanceDashboard />);
    await user.click(screen.getByRole("button", { name: /Review failures/i }));

    expect(screen.queryByText("db_active")).not.toBeInTheDocument();

    act(() => {
      useMaintenanceStore.getState().startRun(secondProfile, ["db_reporting"], false);
      useUiStore.getState().setActiveProfileId(secondProfile.id);
    });

    expect(await screen.findByText("db_reporting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All1$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
