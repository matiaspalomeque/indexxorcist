import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/tauri";
import { ProfileFormModal } from "../components/profiles/ProfileFormModal";
import { useI18nStore } from "../store/i18nStore";

vi.mock("../api/tauri", () => ({
  getServerProfiles: vi.fn(),
  saveServerProfile: vi.fn(),
  duplicateServerProfile: vi.fn(),
  testProfileConnection: vi.fn(),
}));

const mockTestProfileConnection = vi.mocked(api.testProfileConnection);

describe("ProfileFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";
    useI18nStore.setState({ lang: "en" });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears a successful test result when connection fields change", async () => {
    const user = userEvent.setup();
    mockTestProfileConnection.mockResolvedValue(undefined);

    render(<ProfileFormModal mode="create" onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Server *"), "sql.example.local");
    await user.type(screen.getByLabelText("Username *"), "sa");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret");
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Connection succeeded.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Server *"), "-changed");

    expect(screen.queryByText("Connection succeeded.")).not.toBeInTheDocument();
  });
});
