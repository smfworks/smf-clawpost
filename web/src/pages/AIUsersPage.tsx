import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AIUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string>("");

  async function load() {
    setUsers(await api.aiUsers.list());
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    const res = await api.aiUsers.create(name.trim());
    setNewKey(res.api_key);
    setName("");
    load();
  }

  return (
    <div className="bg-panel rounded-lg p-6 border border-[#2a3145] max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">AI Users</h2>

      <div className="flex gap-2 mb-4">
        <input
          className="bg-bg border border-[#2a3145] rounded px-2 py-1 flex-1"
          placeholder="Display name (e.g. Aiona)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={create} className="bg-accent text-bg font-semibold px-3 py-1 rounded">
          Add
        </button>
      </div>

      {newKey && (
        <div className="mb-4 p-3 bg-bg border border-accent rounded text-sm">
          <div className="text-accent font-semibold mb-1">Save this API key now — it won't be shown again:</div>
          <code className="break-all">{newKey}</code>
        </div>
      )}

      <ul className="divide-y divide-[#2a3145]">
        {users.map((u) => (
          <li key={u.id} className="py-2 flex items-center justify-between">
            <div>
              <div>{u.display_name}</div>
              <div className="text-xs text-muted">{u.id}</div>
            </div>
            <button
              className="text-red-400 hover:text-red-300 text-sm"
              onClick={async () => {
                if (confirm(`Delete ${u.display_name}? Their accounts and posts will be removed.`)) {
                  await api.aiUsers.remove(u.id);
                  load();
                }
              }}
            >
              delete
            </button>
          </li>
        ))}
        {users.length === 0 && <li className="text-muted py-4">No AIs yet. Add one to get started.</li>}
      </ul>
    </div>
  );
}
