import { NavLink, Route, Routes } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage.js";
import ComposePage from "./pages/ComposePage.js";
import AccountsPage from "./pages/AccountsPage.js";
import AIUsersPage from "./pages/AIUsersPage.js";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#2a3145] px-6 py-3 flex items-center gap-6 bg-panel">
        <div className="font-bold text-lg">🐾 Clawpost</div>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "text-accent" : "text-muted hover:text-ink")}>
            Calendar
          </NavLink>
          <NavLink to="/compose" className={({ isActive }) => (isActive ? "text-accent" : "text-muted hover:text-ink")}>
            Compose
          </NavLink>
          <NavLink to="/accounts" className={({ isActive }) => (isActive ? "text-accent" : "text-muted hover:text-ink")}>
            Accounts
          </NavLink>
          <NavLink to="/ai-users" className={({ isActive }) => (isActive ? "text-accent" : "text-muted hover:text-ink")}>
            AI Users
          </NavLink>
        </nav>
        <div className="ml-auto text-xs text-muted">local-only · v0.1</div>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/compose" element={<ComposePage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/ai-users" element={<AIUsersPage />} />
        </Routes>
      </main>
    </div>
  );
}
