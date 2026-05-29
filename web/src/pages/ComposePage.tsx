import { useEffect, useState } from "react";
import { PLATFORMS, PLATFORM_LABELS } from "@clawpost/shared";
import { api } from "../api.js";

export default function ComposePage() {
  const [aiUsers, setAiUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAI, setSelectedAI] = useState<string>("");
  const [body, setBody] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [scheduledFor, setScheduledFor] = useState<string>(new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16));
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    api.aiUsers.list().then(setAiUsers);
  }, []);

  useEffect(() => {
    if (!selectedAI) return setAccounts([]);
    api.accounts.list(selectedAI).then(setAccounts);
  }, [selectedAI]);

  async function submit() {
    setMsg("");
    if (!selectedAI || selectedAccounts.size === 0 || !body.trim()) {
      setMsg("Pick an AI, at least one account, and write something.");
      return;
    }
    await api.posts.create({
      ai_user_id: selectedAI,
      scheduled_for: new Date(scheduledFor).toISOString(),
      variants: [...selectedAccounts].map((id) => ({ account_id: id, body })),
    });
    setMsg("Scheduled.");
    setBody("");
    setSelectedAccounts(new Set());
  }

  return (
    <div className="bg-panel rounded-lg p-6 border border-[#2a3145] max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">Compose</h2>
      <label className="block text-sm text-muted mb-1">Posting as</label>
      <select
        className="bg-bg border border-[#2a3145] rounded px-2 py-1 mb-4 w-full"
        value={selectedAI}
        onChange={(e) => setSelectedAI(e.target.value)}
      >
        <option value="">— pick AI —</option>
        {aiUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name}
          </option>
        ))}
      </select>

      <label className="block text-sm text-muted mb-1">Target accounts</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {PLATFORMS.map((p) => {
          const acctsForPlatform = accounts.filter((a) => a.platform === p);
          return (
            <div key={p} className="border border-[#2a3145] rounded p-2">
              <div className="text-xs text-muted uppercase mb-1">{PLATFORM_LABELS[p]}</div>
              {acctsForPlatform.length === 0 && <div className="text-xs text-muted">no accounts</div>}
              {acctsForPlatform.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(selectedAccounts);
                      e.target.checked ? next.add(a.id) : next.delete(a.id);
                      setSelectedAccounts(next);
                    }}
                  />
                  @{a.handle}
                </label>
              ))}
            </div>
          );
        })}
      </div>

      <label className="block text-sm text-muted mb-1">Body</label>
      <textarea
        className="w-full bg-bg border border-[#2a3145] rounded px-3 py-2 h-32 mb-4"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your post…"
      />

      <label className="block text-sm text-muted mb-1">Scheduled for</label>
      <input
        type="datetime-local"
        className="bg-bg border border-[#2a3145] rounded px-2 py-1 mb-4"
        value={scheduledFor}
        onChange={(e) => setScheduledFor(e.target.value)}
      />

      <div>
        <button onClick={submit} className="bg-accent text-bg font-semibold px-4 py-2 rounded">
          Schedule
        </button>
        {msg && <span className="ml-3 text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
