import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://hmvrgrmirkdcbmyyifjq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnJncm1pcmtkY2JteXlpZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDYyNzAsImV4cCI6MjA5MTI4MjI3MH0._Oq5Q2jkBT6XZyHBhc2zALIDa64ZCNuExHjWBY2vzPk";

const db = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    ...opts,
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const get = (table, query = "") => db(`${table}?${query}`);
const insert = (table, body) => db(table, { method: "POST", body: JSON.stringify(body) });
const update = (table, match, body) => db(`${table}?${match}`, { method: "PATCH", body: JSON.stringify(body) });
const del = (table, match) => db(`${table}?${match}`, { method: "DELETE", prefer: "return=minimal" });

const FISH_TYPES = ["Rohu","Catla","Mrigal","Tilapia","Pangasius","Hilsa","Shrimp","Carp","Other"];
const EXP_CATS = ["Feed","Rent","Labor","Medicine & Chemicals","Equipment","Water/Electricity","Other"];
const TABS = ["Home","Stock","Harvest","Sales","Expenses","Feed","Market","AI"];

function today() { return new Date().toISOString().split("T")[0]; }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function fmt(n, cur = "TAKA", rate = 85) {
  const v = Number(n || 0);
  if (cur === "CAD") return "CA$" + (v / rate).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "৳" + Math.round(v).toLocaleString("en-IN");
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        {label}{hint && <span className="text-xs text-gray-400 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400";
const btnC = (c = "green") => `bg-${c}-600 hover:bg-${c}-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition`;

export default function App() {
  const [tab, setTab] = useState("Home");
  const [modal, setModal] = useState(null);
  const [cur, setCur] = useState("TAKA");
  const [cadToTaka, setCadToTaka] = useState(85);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [ponds, setPonds] = useState([]);
  const [stock, setStock] = useState([]);
  const [harvest, setHarvest] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [feedBags, setFeedBags] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);

  const toTaka = (cad) => Number(cad || 0) * cadToTaka;
  const display = (taka) => fmt(taka, cur, cadToTaka);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, st, ha, sa, ex, fb, mp, sett] = await Promise.all([
        get("ponds", "order=created_at.asc"),
        get("stock", "order=created_at.desc"),
        get("harvest", "order=created_at.desc"),
        get("sales", "order=created_at.desc"),
        get("expenses", "order=created_at.desc"),
        get("feed_bags", "order=created_at.desc"),
        get("market_prices", "order=date.desc"),
        get("settings", "id=eq.1"),
      ]);
      setPonds(p); setStock(st); setHarvest(ha); setSales(sa);
      setExpenses(ex); setFeedBags(fb); setMarketPrices(mp);
      if (sett[0]) setCadToTaka(sett[0].cad_to_taka);
    } catch (e) { alert("Failed to load data: " + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function pondStats(pid) {
    const isAll = pid === "all";
    const sharedExp = expenses.filter(e => e.shared);
    const directExp = expenses.filter(e => !e.shared && (isAll || e.pond_id === pid));
    const sharedShare = sharedExp.reduce((s, e) => s + Number(e.amount_taka), 0) / Math.max(ponds.length, 1);
    const totalExp = directExp.reduce((s, e) => s + Number(e.amount_taka), 0) + sharedShare;
    const stockCost = stock.filter(s => isAll || s.pond_id === pid).reduce((s, f) => s + Number(f.cost_taka), 0);
    const revenue = sales.filter(s => isAll || s.pond_id === pid).reduce((s, sl) => s + Number(sl.revenue_taka), 0);
    const totalCost = totalExp + stockCost;
    const profit = revenue - totalCost;
    const roi = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(1) : null;
    return { totalExp, stockCost, revenue, totalCost, profit, roi };
  }

  function feedStats(pid) {
    const bags = feedBags.filter(b => b.pond_id === pid);
    const totalFeedKg = bags.reduce((s, b) => s + Number(b.weight_kg), 0);
    const totalFeedCost = bags.reduce((s, b) => s + Number(b.cost_taka), 0);
    const stockedKg = stock.filter(s => s.pond_id === pid).reduce((s, f) => s + Number(f.weight_kg), 0);
    const harvestedKg = harvest.filter(h => h.pond_id === pid).reduce((s, h) => s + Number(h.weight_kg), 0);
    const weightGain = harvestedKg - stockedKg;
    const fcr = weightGain > 0 ? (totalFeedKg / weightGain).toFixed(2) : null;
    const costPerKgProduced = weightGain > 0 ? totalFeedCost / weightGain : null;
    const finished = bags.filter(b => b.finished_date);
    const durations = finished.map(b => daysBetween(b.start_date, b.finished_date)).filter(d => d > 0);
    const avgDays = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;
    const costPerKgFeed = totalFeedKg > 0 ? totalFeedCost / totalFeedKg : null;
    return { bags, totalFeedKg, totalFeedCost, fcr, costPerKgProduced, weightGain, avgDays, costPerKgFeed };
  }

  function pondVerdict(pid) {
    const s = pondStats(pid);
    const fs = feedStats(pid);
    const issues = [], goods = [];
    if (s.revenue === 0 && s.totalCost === 0) return { color: "gray", emoji: "⚪", headline: "No data yet", detail: "Start logging stock and sales." };
    if (s.profit < 0) issues.push("losing money");
    else if (s.profit > 0) goods.push("making money");
    if (fs.fcr) {
      const f = Number(fs.fcr);
      if (f > 2.5) issues.push("wasting too much feed");
      else if (f < 1.5) goods.push("feed is very efficient");
    }
    if (s.revenue === 0 && s.totalCost > 0) issues.push("no sales yet");
    if (issues.length >= 2) return { color: "red", emoji: "🔴", headline: "Needs attention", detail: "This pond is " + issues.join(" and ") + "." };
    if (issues.length === 1) return { color: "yellow", emoji: "🟡", headline: "Could be better", detail: "This pond is " + issues[0] + "." };
    if (goods.length > 0) return { color: "green", emoji: "🟢", headline: "Doing well", detail: "This pond is " + goods.join(" and ") + "." };
    return { color: "gray", emoji: "⚪", headline: "Too early to tell", detail: "Keep logging data." };
  }

  const deleteRow = async (table, id) => {
    try { await del(table, `id=eq.${id}`); await loadAll(); } catch (e) { alert("Error: " + e.message); }
  };

  function StockForm() {
    const [f, setF] = useState({ pond_id: ponds[0]?.id || "", type: "Rohu", count: "", weight_kg: "", price_per_kg: "", priceCur: "TAKA", date: today(), notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const submit = async () => {
      if (!f.count || !f.weight_kg || !f.price_per_kg) return alert("Fill all required fields");
      const cpk = f.priceCur === "CAD" ? toTaka(f.price_per_kg) : Number(f.price_per_kg);
      setSaving(true);
      try {
        await insert("stock", { pond_id: f.pond_id, type: f.type, count: Number(f.count), weight_kg: Number(f.weight_kg), price_per_kg_taka: cpk, cost_taka: cpk * Number(f.weight_kg), remaining_kg: Number(f.weight_kg), remaining_count: Number(f.count), date: f.date, notes: f.notes });
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Pond"><select className={inp} value={f.pond_id} onChange={ch("pond_id")}>{ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Fish Type"><select className={inp} value={f.type} onChange={ch("type")}>{FISH_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Count *"><input className={inp} type="number" placeholder="500" value={f.count} onChange={ch("count")} /></Field>
        <Field label="Weight (kg) *"><input className={inp} type="number" placeholder="50" value={f.weight_kg} onChange={ch("weight_kg")} /></Field>
      </div>
      <Field label="Buy Price / kg *">
        <div className="flex gap-2">
          <input className={inp} type="number" value={f.price_per_kg} onChange={ch("price_per_kg")} />
          <select className="border rounded-lg px-2 text-sm" value={f.priceCur} onChange={ch("priceCur")}><option>TAKA</option><option>CAD</option></select>
        </div>
      </Field>
      {f.weight_kg && f.price_per_kg && <div className="bg-green-50 rounded-lg p-3 text-sm mb-3">Total cost: <b>{display((f.priceCur === "CAD" ? toTaka(f.price_per_kg) : Number(f.price_per_kg)) * Number(f.weight_kg))}</b></div>}
      <Field label="Date"><input className={inp} type="date" value={f.date} onChange={ch("date")} /></Field>
      <Field label="Notes"><input className={inp} value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC()} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Add Stock"}</button>
    </>;
  }

  function HarvestForm() {
    const [f, setF] = useState({ pond_id: ponds[0]?.id || "", stock_id: "", weight_kg: "", count: "", date: today(), notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const pondStock = stock.filter(s => s.pond_id === f.pond_id && Number(s.remaining_kg) > 0);
    const submit = async () => {
      if (!f.weight_kg || !f.count) return alert("Fill required fields");
      setSaving(true);
      try {
        await insert("harvest", { pond_id: f.pond_id, stock_id: f.stock_id || null, weight_kg: Number(f.weight_kg), count: Number(f.count), date: f.date, notes: f.notes });
        if (f.stock_id) {
          const s = stock.find(s => s.id === f.stock_id);
          if (s) await update("stock", `id=eq.${s.id}`, { remaining_kg: Math.max(0, Number(s.remaining_kg) - Number(f.weight_kg)), remaining_count: Math.max(0, Number(s.remaining_count) - Number(f.count)) });
        }
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Pond"><select className={inp} value={f.pond_id} onChange={ch("pond_id")}>{ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Stock Batch" hint="optional"><select className={inp} value={f.stock_id} onChange={ch("stock_id")}><option value="">— Select —</option>{pondStock.map(s => <option key={s.id} value={s.id}>{s.type} | {s.date} | {s.remaining_kg}kg left</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Weight (kg) *"><input className={inp} type="number" value={f.weight_kg} onChange={ch("weight_kg")} /></Field>
        <Field label="Count *"><input className={inp} type="number" value={f.count} onChange={ch("count")} /></Field>
      </div>
      <Field label="Date"><input className={inp} type="date" value={f.date} onChange={ch("date")} /></Field>
      <Field label="Notes"><input className={inp} value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC()} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Record Harvest"}</button>
    </>;
  }

  function SaleForm() {
    const [f, setF] = useState({ pond_id: ponds[0]?.id || "", harvest_id: "", weight_kg: "", price_per_kg: "", priceCur: "TAKA", buyer: "", date: today(), notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const ph = harvest.filter(h => h.pond_id === f.pond_id);
    const submit = async () => {
      if (!f.weight_kg || !f.price_per_kg) return alert("Fill required fields");
      const rpk = f.priceCur === "CAD" ? toTaka(f.price_per_kg) : Number(f.price_per_kg);
      setSaving(true);
      try {
        await insert("sales", { pond_id: f.pond_id, harvest_id: f.harvest_id || null, weight_kg: Number(f.weight_kg), revenue_per_kg_taka: rpk, revenue_taka: rpk * Number(f.weight_kg), buyer: f.buyer, date: f.date, notes: f.notes });
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Pond"><select className={inp} value={f.pond_id} onChange={ch("pond_id")}>{ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Harvest Batch" hint="optional"><select className={inp} value={f.harvest_id} onChange={ch("harvest_id")}><option value="">— Select —</option>{ph.map(h => <option key={h.id} value={h.id}>{h.date} | {h.weight_kg}kg</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Weight Sold (kg) *"><input className={inp} type="number" value={f.weight_kg} onChange={ch("weight_kg")} /></Field>
        <Field label="Buyer"><input className={inp} value={f.buyer} onChange={ch("buyer")} /></Field>
      </div>
      <Field label="Sale Price / kg *">
        <div className="flex gap-2">
          <input className={inp} type="number" value={f.price_per_kg} onChange={ch("price_per_kg")} />
          <select className="border rounded-lg px-2 text-sm" value={f.priceCur} onChange={ch("priceCur")}><option>TAKA</option><option>CAD</option></select>
        </div>
      </Field>
      {f.weight_kg && f.price_per_kg && <div className="bg-green-50 rounded-lg p-3 text-sm mb-3">Revenue: <b>{display((f.priceCur === "CAD" ? toTaka(f.price_per_kg) : Number(f.price_per_kg)) * Number(f.weight_kg))}</b></div>}
      <Field label="Date"><input className={inp} type="date" value={f.date} onChange={ch("date")} /></Field>
      <Field label="Notes"><input className={inp} value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC()} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Record Sale"}</button>
    </>;
  }

  function ExpenseForm() {
    const [f, setF] = useState({ pond_id: ponds[0]?.id || "", shared: false, category: "Feed", amount: "", amountCur: "TAKA", date: today(), notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const submit = async () => {
      if (!f.amount) return alert("Enter amount");
      const amt = f.amountCur === "CAD" ? toTaka(f.amount) : Number(f.amount);
      setSaving(true);
      try {
        await insert("expenses", { pond_id: f.shared ? null : f.pond_id, shared: f.shared, category: f.category, amount_taka: amt, date: f.date, notes: f.notes });
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Category"><select className={inp} value={f.category} onChange={ch("category")}>{EXP_CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Assign To">
        <div className="flex gap-2 items-center">
          <select className={inp} disabled={f.shared} value={f.pond_id} onChange={ch("pond_id")}>{ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <label className="flex items-center gap-1 text-sm whitespace-nowrap cursor-pointer"><input type="checkbox" checked={f.shared} onChange={e => setF(p => ({ ...p, shared: e.target.checked }))} /> Shared</label>
        </div>
        {f.shared && <p className="text-xs text-gray-400 mt-1">Split evenly across all ponds</p>}
      </Field>
      <Field label="Amount *">
        <div className="flex gap-2">
          <input className={inp} type="number" value={f.amount} onChange={ch("amount")} />
          <select className="border rounded-lg px-2 text-sm" value={f.amountCur} onChange={ch("amountCur")}><option>TAKA</option><option>CAD</option></select>
        </div>
      </Field>
      <Field label="Date"><input className={inp} type="date" value={f.date} onChange={ch("date")} /></Field>
      <Field label="Notes"><input className={inp} value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC("red")} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Add Expense"}</button>
    </>;
  }

  function FeedBagForm() {
    const [f, setF] = useState({ pond_id: ponds[0]?.id || "", brand: "", weight_kg: "", cost: "", costCur: "TAKA", start_date: today(), finished_date: "", notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const submit = async () => {
      if (!f.weight_kg || !f.cost) return alert("Fill required fields");
      const costTaka = f.costCur === "CAD" ? toTaka(f.cost) : Number(f.cost);
      setSaving(true);
      try {
        await insert("feed_bags", { pond_id: f.pond_id, brand: f.brand, weight_kg: Number(f.weight_kg), cost_taka: costTaka, start_date: f.start_date, finished_date: f.finished_date || null, notes: f.notes });
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Pond"><select className={inp} value={f.pond_id} onChange={ch("pond_id")}>{ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Brand / Type"><input className={inp} placeholder="e.g. Quality Feeds Pro" value={f.brand} onChange={ch("brand")} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bag Weight (kg) *"><input className={inp} type="number" placeholder="25" value={f.weight_kg} onChange={ch("weight_kg")} /></Field>
        <Field label="Cost *">
          <div className="flex gap-1">
            <input className={inp} type="number" value={f.cost} onChange={ch("cost")} />
            <select className="border rounded-lg px-1 text-xs" value={f.costCur} onChange={ch("costCur")}><option>TAKA</option><option>CAD</option></select>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Started"><input className={inp} type="date" value={f.start_date} onChange={ch("start_date")} /></Field>
        <Field label="Finished" hint="optional"><input className={inp} type="date" value={f.finished_date} onChange={ch("finished_date")} /></Field>
      </div>
      <Field label="Notes"><input className={inp} value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC()} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Log Feed Bag"}</button>
    </>;
  }

  function MarketForm() {
    const [f, setF] = useState({ type: "Rohu", price: "", priceCur: "TAKA", date: today(), notes: "" });
    const ch = k => e => setF(p => ({ ...p, [k]: e.target.value }));
    const submit = async () => {
      if (!f.price) return alert("Enter a price");
      const priceTaka = f.priceCur === "CAD" ? toTaka(f.price) : Number(f.price);
      setSaving(true);
      try {
        await insert("market_prices", { type: f.type, price_taka: priceTaka, date: f.date, notes: f.notes });
        await loadAll(); setModal(null);
      } catch (e) { alert("Error: " + e.message); }
      setSaving(false);
    };
    return <>
      <Field label="Fish Type"><select className={inp} value={f.type} onChange={ch("type")}>{FISH_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Market Price / kg">
        <div className="flex gap-2">
          <input className={inp} type="number" value={f.price} onChange={ch("price")} />
          <select className="border rounded-lg px-2 text-sm" value={f.priceCur} onChange={ch("priceCur")}><option>TAKA</option><option>CAD</option></select>
        </div>
      </Field>
      <Field label="Date"><input className={inp} type="date" value={f.date} onChange={ch("date")} /></Field>
      <Field label="Source / Notes"><input className={inp} placeholder="e.g. Dhaka market" value={f.notes} onChange={ch("notes")} /></Field>
      <button className={btnC()} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Price"}</button>
    </>;
  }

  async function askAI() {
    if (!aiInput.trim()) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiChat(c => [...c, { role: "user", content: userMsg }]);
    setAiLoading(true);
    const pondSummaries = ponds.map(p => {
      const s = pondStats(p.id); const fs = feedStats(p.id);
      return `${p.name}: Revenue ${fmt(s.revenue)}, Cost ${fmt(s.totalCost)}, Profit ${fmt(s.profit)}, ROI ${s.roi || "N/A"}%, FCR ${fs.fcr || "N/A"}, Cost/kg produced ${fs.costPerKgProduced ? fmt(fs.costPerKgProduced) : "N/A"}`;
    }).join("\n");
    const system = `You are an expert aquaculture advisor for Bangladesh pond farming. 3 ponds summary:\n${pondSummaries}\nExchange rate: 1 CAD = ${cadToTaka} Taka. FCR guide: <1.5 excellent, 1.5-2 good, 2-2.5 average, >2.5 poor. Be concise and practical.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages: [...aiChat.slice(-6), { role: "user", content: userMsg }] })
      });
      const d = await res.json();
      setAiChat(c => [...c, { role: "assistant", content: d.content?.map(b => b.text || "").join("") || "No response." }]);
    } catch { setAiChat(c => [...c, { role: "assistant", content: "Error. Try again." }]); }
    setAiLoading(false);
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="text-4xl mb-4">🐟</div>
      <div className="text-gray-500 font-medium">Loading pond data...</div>
    </div>
  );

  const allS = pondStats("all");

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter,sans-serif" }}>
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="font-bold text-lg text-green-700">🐟 Pond Tracker</h1>
          <p className="text-xs text-gray-400">Bangladesh · {ponds.length} Ponds</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-xs border rounded px-2 py-1" value={cur} onChange={e => setCur(e.target.value)}>
            <option value="TAKA">৳ Taka</option><option value="CAD">CA$ CAD</option>
          </select>
          <button onClick={() => setModal("settings")} className="text-xl">⚙️</button>
        </div>
      </div>

      <div className="flex overflow-x-auto bg-white border-b px-2 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm whitespace-nowrap font-medium border-b-2 transition ${tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500"}`}>
            {t === "AI" ? "🤖 AI" : t}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {tab === "Home" && (
          <div>
            <p className="text-xs text-gray-400 text-center mb-4 uppercase tracking-wide">How are your ponds doing?</p>
            {ponds.map(p => {
              const v = pondVerdict(p.id);
              const s = pondStats(p.id);
              const bgColors = { green: "bg-green-50 border-green-200", yellow: "bg-yellow-50 border-yellow-200", red: "bg-red-50 border-red-200", gray: "bg-gray-50 border-gray-200" };
              const textColors = { green: "text-green-700", yellow: "text-yellow-700", red: "text-red-600", gray: "text-gray-400" };
              return (
                <div key={p.id} className={`rounded-2xl border-2 p-5 mb-4 ${bgColors[v.color]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg">{p.name}</span>
                    <span className="text-2xl">{v.emoji}</span>
                  </div>
                  <div className={`text-xl font-bold mb-1 ${textColors[v.color]}`}>{v.headline}</div>
                  <div className="text-sm text-gray-600 mb-3">{v.detail}</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white rounded-xl p-2"><div className="text-gray-400">Money in</div><div className="font-bold text-green-600">{display(s.revenue)}</div></div>
                    <div className="bg-white rounded-xl p-2"><div className="text-gray-400">Money spent</div><div className="font-bold text-red-500">{display(s.totalCost)}</div></div>
                    <div className="bg-white rounded-xl p-2"><div className="text-gray-400">Profit</div><div className={`font-bold ${s.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{display(s.profit)}</div></div>
                  </div>
                </div>
              );
            })}
            <div className="bg-white rounded-2xl border p-4 mt-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">All Ponds Combined</div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-green-50 rounded-xl p-3"><div className="text-xs text-gray-400">Total Revenue</div><div className="font-bold text-green-700 text-lg">{display(allS.revenue)}</div></div>
                <div className="bg-red-50 rounded-xl p-3"><div className="text-xs text-gray-400">Total Costs</div><div className="font-bold text-red-600 text-lg">{display(allS.totalCost)}</div></div>
                <div className="bg-blue-50 rounded-xl p-3 col-span-2"><div className="text-xs text-gray-400">Net Profit</div><div className={`font-bold text-2xl ${allS.profit >= 0 ? "text-blue-700" : "text-red-600"}`}>{display(allS.profit)}</div></div>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Quick Log</p>
              <div className="grid grid-cols-2 gap-2">
                {[["🐟 Add Fish", "stock"], ["🎣 Record Harvest", "harvest"], ["💰 Record Sale", "sale"], ["💸 Add Expense", "expense"], ["🌾 Log Feed Bag", "feedbag"], ["📈 Update Price", "market"]].map(([label, key]) => (
                  <button key={key} onClick={() => setModal(key)} className="bg-white border-2 border-gray-100 rounded-2xl p-4 text-sm font-semibold text-gray-700 hover:border-green-300 hover:bg-green-50 transition text-left">{label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "Stock" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Fish Stock</h2>
              <button className={btnC()} onClick={() => setModal("stock")}>+ Add Stock</button>
            </div>
            {stock.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No stock recorded yet.</p>}
            {stock.map(s => (
              <div key={s.id} className="bg-white rounded-xl border p-3 mb-2">
                <div className="flex justify-between">
                  <div><span className="font-semibold">{s.type}</span><span className="text-xs text-gray-400 ml-2">{ponds.find(p => p.id === s.pond_id)?.name}</span></div>
                  <button onClick={() => deleteRow("stock", s.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                  <div>📦 {s.count} fish</div><div>⚖️ {s.weight_kg}kg</div><div>📉 {s.remaining_kg}kg left</div>
                  <div>💰 {display(s.price_per_kg_taka)}/kg</div><div>🗓 {s.date}</div><div>Total: {display(s.cost_taka)}</div>
                </div>
                {s.notes && <div className="text-xs text-gray-400 mt-1">📝 {s.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === "Harvest" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Harvests</h2>
              <button className={btnC()} onClick={() => setModal("harvest")}>+ Record Harvest</button>
            </div>
            {harvest.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No harvests yet.</p>}
            {harvest.map(h => (
              <div key={h.id} className="bg-white rounded-xl border p-3 mb-2">
                <div className="flex justify-between">
                  <div><span className="font-semibold">{ponds.find(p => p.id === h.pond_id)?.name}</span><span className="text-xs text-gray-400 ml-2">{h.date}</span></div>
                  <button onClick={() => deleteRow("harvest", h.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
                  <div>⚖️ {h.weight_kg} kg</div><div>🐟 {h.count} fish</div>
                </div>
                {h.notes && <div className="text-xs text-gray-400 mt-1">📝 {h.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === "Sales" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Sales</h2>
              <button className={btnC()} onClick={() => setModal("sale")}>+ Record Sale</button>
            </div>
            {sales.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No sales yet.</p>}
            {sales.map(s => (
              <div key={s.id} className="bg-white rounded-xl border p-3 mb-2">
                <div className="flex justify-between">
                  <div><span className="font-semibold">{ponds.find(p => p.id === s.pond_id)?.name}</span>{s.buyer && <span className="text-xs text-gray-400 ml-2">→ {s.buyer}</span>}</div>
                  <button onClick={() => deleteRow("sales", s.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
                  <div>⚖️ {s.weight_kg} kg</div><div>💰 {display(s.revenue_per_kg_taka)}/kg</div>
                  <div className="font-semibold text-green-600">{display(s.revenue_taka)}</div>
                  <div>🗓 {s.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Expenses" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Expenses</h2>
              <button className={btnC("red")} onClick={() => setModal("expense")}>+ Add Expense</button>
            </div>
            <div className="bg-white rounded-xl border p-3 mb-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">BY CATEGORY</h4>
              {EXP_CATS.map(cat => {
                const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount_taka), 0);
                if (!total) return null;
                return <div key={cat} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{cat}</span><span className="font-semibold text-red-600">{display(total)}</span></div>;
              })}
              {!expenses.length && <p className="text-gray-400 text-sm text-center py-2">No expenses yet.</p>}
            </div>
            {expenses.map(e => (
              <div key={e.id} className="bg-white rounded-xl border p-3 mb-2">
                <div className="flex justify-between">
                  <div><span className="font-semibold">{e.category}</span><span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${e.shared ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>{e.shared ? "Shared" : ponds.find(p => p.id === e.pond_id)?.name}</span></div>
                  <button onClick={() => deleteRow("expenses", e.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span className="text-red-600 font-semibold">{display(e.amount_taka)}</span>
                  <span>🗓 {e.date}</span>{e.notes && <span>📝 {e.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Feed" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Feed Optimization</h2>
              <button className={btnC()} onClick={() => setModal("feedbag")}>+ Log Feed Bag</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {ponds.map(p => {
                const fs = feedStats(p.id);
                const fcrColor = !fs.fcr ? "gray" : Number(fs.fcr) < 1.5 ? "green" : Number(fs.fcr) < 2 ? "yellow" : "red";
                const colors = { green: "bg-green-50 text-green-700", yellow: "bg-yellow-50 text-yellow-700", red: "bg-red-50 text-red-600", gray: "bg-gray-50 text-gray-400" };
                return (
                  <div key={p.id} className={`rounded-xl p-3 text-center ${colors[fcrColor]}`}>
                    <div className="text-xs opacity-70 mb-1">{p.name}</div>
                    <div className="text-lg font-bold">{fs.fcr || "—"}</div>
                    <div className="text-xs opacity-60">FCR</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">FCR: &lt;1.5 excellent · 1.5–2.0 good · 2.0–2.5 average · &gt;2.5 poor</p>
            {ponds.map(p => {
              const fs = feedStats(p.id);
              if (!fs.bags.length) return null;
              return (
                <div key={p.id} className="bg-white rounded-xl border p-3 mb-3">
                  <h4 className="font-semibold text-sm mb-2">{p.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Total Feed Used</div><div className="font-semibold">{fs.totalFeedKg} kg</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Feed Cost</div><div className="font-semibold">{display(fs.totalFeedCost)}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Weight Gain</div><div className="font-semibold">{fs.weightGain > 0 ? fs.weightGain + "kg" : "Need harvest"}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Cost/kg Produced</div><div className="font-semibold">{fs.costPerKgProduced ? display(fs.costPerKgProduced) : "—"}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Avg Bag Duration</div><div className="font-semibold">{fs.avgDays ? fs.avgDays + " days" : "—"}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400">Cost/kg of Feed</div><div className="font-semibold">{fs.costPerKgFeed ? display(fs.costPerKgFeed) : "—"}</div></div>
                  </div>
                </div>
              );
            })}
            <h3 className="font-semibold text-gray-600 text-sm mb-2">Feed Bag Log</h3>
            {!feedBags.length && <p className="text-gray-400 text-sm text-center py-4">No feed bags logged yet.</p>}
            {feedBags.map(b => (
              <div key={b.id} className="bg-white rounded-xl border p-3 mb-2">
                <div className="flex justify-between">
                  <div><span className="font-semibold">{b.brand || "Feed bag"}</span><span className="text-xs text-gray-400 ml-2">{ponds.find(p => p.id === b.pond_id)?.name}</span></div>
                  <button onClick={() => deleteRow("feed_bags", b.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                  <div>⚖️ {b.weight_kg}kg</div><div>💰 {display(b.cost_taka)}</div><div>📅 {b.start_date}</div>
                </div>
                {b.finished_date
                  ? <div className="mt-1 text-xs text-green-600">✓ Finished {b.finished_date} · {daysBetween(b.start_date, b.finished_date)} days</div>
                  : <button className="mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full" onClick={async () => {
                    const d = prompt("Date finished? (YYYY-MM-DD)", today());
                    if (d) { await update("feed_bags", `id=eq.${b.id}`, { finished_date: d }); await loadAll(); }
                  }}>Mark as finished →</button>}
                {b.notes && <div className="text-xs text-gray-400 mt-1">📝 {b.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === "Market" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Market Prices</h2>
              <button className={btnC()} onClick={() => setModal("market")}>+ Update Price</button>
            </div>
            <div className="bg-white rounded-xl border mb-4 overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-2">
                <div>Fish</div><div>Market/kg</div><div>Avg Sale/kg</div><div>Margin</div>
              </div>
              {FISH_TYPES.map(type => {
                const latest = marketPrices.filter(p => p.type === type)[0];
                const typeSales = sales.filter(s => stock.find(st => st.pond_id === s.pond_id && st.type === type));
                const avgSale = typeSales.length ? typeSales.reduce((s, sl) => s + Number(sl.revenue_per_kg_taka), 0) / typeSales.length : null;
                const marketTaka = latest ? Number(latest.price_taka) : null;
                const margin = marketTaka && avgSale ? (((avgSale - marketTaka) / marketTaka) * 100).toFixed(1) : null;
                if (!latest && !typeSales.length) return null;
                return (
                  <div key={type} className="grid grid-cols-4 text-sm px-3 py-2 border-t items-center">
                    <div className="font-medium">{type}</div>
                    <div>{marketTaka ? display(marketTaka) : <span className="text-gray-300">—</span>}</div>
                    <div>{avgSale ? display(avgSale) : <span className="text-gray-300">—</span>}</div>
                    <div>{margin !== null ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(margin) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{margin > 0 ? "+" : ""}{margin}%</span> : <span className="text-gray-300 text-xs">—</span>}</div>
                  </div>
                );
              })}
              {!marketPrices.length && !sales.length && <p className="text-gray-400 text-sm text-center py-6">No prices logged yet.</p>}
            </div>
            {marketPrices.map(p => (
              <div key={p.id} className="bg-white rounded-xl border p-3 mb-2 flex justify-between items-center">
                <div><span className="font-semibold">{p.type}</span><span className="text-xs text-gray-400 ml-2">{p.date}</span>{p.notes && <span className="text-xs text-gray-400 ml-2">· {p.notes}</span>}</div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-blue-600">{display(p.price_taka)}<span className="text-xs font-normal text-gray-400">/kg</span></span>
                  <button onClick={() => deleteRow("market_prices", p.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "AI" && (
          <div>
            <div className="bg-green-50 rounded-xl p-3 mb-4 text-sm text-green-700">
              🤖 Ask anything — profits, feed, which fish to stock, when to sell, and more.
            </div>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {aiChat.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  <div className="text-3xl mb-2">🐟</div>
                  <div>Try: "Which pond is doing best?" or "How do I reduce feed costs?"</div>
                </div>
              )}
              {aiChat.map((m, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm ${m.role === "user" ? "bg-green-600 text-white ml-8" : "bg-white border mr-8"}`}>{m.content}</div>
              ))}
              {aiLoading && <div className="bg-white border rounded-xl p-3 text-sm text-gray-400 mr-8">Analyzing your pond data...</div>}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="Ask about your ponds..." />
              <button className={btnC()} onClick={askAI}>Ask</button>
            </div>
          </div>
        )}
      </div>

      {modal === "stock" && <Modal title="Add Fish Stock" onClose={() => setModal(null)}><StockForm /></Modal>}
      {modal === "harvest" && <Modal title="Record Harvest" onClose={() => setModal(null)}><HarvestForm /></Modal>}
      {modal === "sale" && <Modal title="Record Sale" onClose={() => setModal(null)}><SaleForm /></Modal>}
      {modal === "expense" && <Modal title="Add Expense" onClose={() => setModal(null)}><ExpenseForm /></Modal>}
      {modal === "feedbag" && <Modal title="Log Feed Bag" onClose={() => setModal(null)}><FeedBagForm /></Modal>}
      {modal === "market" && <Modal title="Update Market Price" onClose={() => setModal(null)}><MarketForm /></Modal>}
      {modal === "settings" && (
        <Modal title="Settings" onClose={() => setModal(null)}>
          <Field label="CAD → Taka Exchange Rate">
            <div className="flex gap-2 items-center">
              <input className={inp} type="number" value={cadToTaka} onChange={e => setCadToTaka(Number(e.target.value))} />
              <span className="text-sm text-gray-400">Taka / CA$1</span>
            </div>
          </Field>
          <button className={btnC() + " w-full mt-2"} onClick={async () => {
            try { await update("settings", "id=eq.1", { cad_to_taka: cadToTaka }); alert("Saved!"); setModal(null); } catch (e) { alert("Error: " + e.message); }
          }}>Save Rate</button>
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">Pond Names</p>
            {ponds.map(p => (
              <div key={p.id} className="flex gap-2 mb-2">
                <input className={inp} defaultValue={p.name} onBlur={async e => {
                  if (e.target.value !== p.name) {
                    try { await update("ponds", `id=eq.${p.id}`, { name: e.target.value }); await loadAll(); } catch (err) { alert("Error: " + err.message); }
                  }
                }} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
