import { useMaintenanceEvents } from "./hooks/useMaintenanceEvents";
import { AppShell } from "./components/layout/AppShell";
import { UpdateBanner } from "./components/UpdateBanner";

export default function App() {
  // Mounted once at root — persists across view navigation
  useMaintenanceEvents();

  return (
    <>
      <AppShell />
      <UpdateBanner />
    </>
  );
}
