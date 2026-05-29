import { useEffect, useState } from "react";
import { PLATFORM_LABELS } from "@clawpost/shared";
import { api } from "../api.js";

export default function AccountsPage() {
  const [aiUsers, setAiUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAI, setSelectedAI] = useState<string>("");

  async function load() {
    const users = await api.aiUsers.list();
    setAiUsers(users);
    if (!selectedAI && users[0]) setSelectedAI(users[0].id);
    const accts = await api.accounts.list(selectedAI || users[0]?.id);
    setAccounts(accts);
  }
  useEffect(() => {
    load();
  }, [selectedAI]);

  function connectX() {
    if (!selectedAI) return alert("pick an AI first");
    window.location.href = `/oauth/x/start?ai_user_id=${selectedAI}`;
  }

  return (
    <div className="bg-panel rounded-lg p-6 border border-[#2a3145] max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">Accounts</h2>
      <label className="block text-sm text-muted mb-1">For AI</label>
      <select
        className="bg-bg border border-[#2a3145] rounded px-2 py-1 mb-4"
        value={selectedAI}
        onChange={(e) => setSelectedAI(e.target.value)}
      >
        {aiUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name}
          </option>
        ))}
      </select>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={connectX} className="bg-accent text-bg font-semibold px-3 py-1 rounded">
          + Connect X
        </button>
        <button disabled className="bg-[#2a3145] text-muted px-3 py-1 rounded cursor-not-allowed">
          + LinkedIn (todo)
        </button>
        <button disabled className="bg-[#2a3145] text-muted px-3 py-1 rounded cursor-not-allowed">
          + Facebook (todo)
        </button>
        <button disabled className="bg-[#2a3145] text-muted px-3 py-1 rounded cursor-not-allowed">
          + Instagram (todo)
        </button>
        <button disabled className="bg-[#2a3145] text-muted px-3 py-1 rounded cursor-not-allowed">
          + TikTok (todo)
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted text-left">
          <tr>
            <th>Platform</th>
            <th>Handle</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-[#2a3145]">
              <td className="py-1">{PLATFORM_LABELS[a.platform as keyof typeof PLATFORM_LABELS]}</td>
              <td>@{a.handle}</td>
              <td className="text-muted">{a.token_status}</td>
              <td>
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={async () => {
                    await api.accounts.remove(a.id);
                    load();
                  }}
                >
                  disconnect
                </button>
              </td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted py-4">
                No accounts connected yet for this AI.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
