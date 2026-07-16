// Apps Script（シート集計）のJSONを取得して data.json を更新する。
// 取得先URLは scripts/config.json の dataEndpoint、または環境変数 DATA_ENDPOINT。
// 未設定/取得失敗のときは既存の data.json を保持して静かに終了（パイプラインは止めない）。
//
// ★このトラッカーの肝：
//   (1) 取得のたびに現在のスナップショットを history.json に記録する。
//   (2) 「24時間前」のスナップショットと今の人数を比べて「増えた分（delta）」を算出。
//       → HTML側で「福岡 +3人！」の演出に使う。24h前が無ければ最古の記録と比較。
//   (3) history.json は推移グラフ（build.jsが1日1点に整形）の元データにもなる。
//   期待するリモート応答: { "prefs": { "東京":12, "福岡":9, ... }, "goal":1000 }
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");

function getEndpoint() {
  if (process.env.DATA_ENDPOINT) return process.env.DATA_ENDPOINT;
  const cfgPath = path.join(__dirname, "config.json");
  if (fs.existsSync(cfgPath)) {
    try { return JSON.parse(fs.readFileSync(cfgPath, "utf8")).dataEndpoint || ""; } catch {}
  }
  return "";
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSONではない応答: " + body.slice(0, 120))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
  });
}

function toNum(v) { return Number(v) || 0; }

(async () => {
  const endpoint = getEndpoint();
  if (!endpoint) {
    console.log("dataEndpoint 未設定 → 既存 data.json を保持（サンプルデータのまま）");
    return;
  }
  try {
    const remote = await fetchJson(endpoint);
    if (!remote || typeof remote !== "object" || !remote.prefs) {
      throw new Error("prefs が無い応答");
    }
    const dataPath = path.join(ROOT, "data.json");
    let base = { prefs: {}, goal: 1000 };
    if (fs.existsSync(dataPath)) { try { base = JSON.parse(fs.readFileSync(dataPath, "utf8")); } catch {} }

    const newPrefs = {};
    for (const [k, v] of Object.entries(remote.prefs)) newPrefs[k] = toNum(v);
    const total = Object.values(newPrefs).reduce((a, b) => a + b, 0);
    const now = new Date();

    // --- history.json（スナップショット履歴）を読む ---
    const histPath = path.join(ROOT, "history.json");
    let history = [];
    if (fs.existsSync(histPath)) { try { history = JSON.parse(fs.readFileSync(histPath, "utf8")); } catch {} }
    if (!Array.isArray(history)) history = [];

    // --- 24時間前のスナップショットを基準に「増えた分」を計算 ---
    const DAY = 24 * 60 * 60 * 1000;
    const cutoff = now.getTime() - DAY;
    // t <= 24h前 の中で最も新しいもの。無ければ最古の記録を使う。
    let ref = null;
    for (const s of history) {
      if (!s || !s.t) continue;
      const tt = new Date(s.t).getTime();
      if (isNaN(tt)) continue;
      if (tt <= cutoff) { if (!ref || tt > new Date(ref.t).getTime()) ref = s; }
    }
    if (!ref && history.length) {
      ref = history.reduce((a, b) => (new Date(a.t) < new Date(b.t) ? a : b));
    }
    const refPrefs = (ref && ref.prefs) || {};
    const delta = {};
    for (const [k, v] of Object.entries(newPrefs)) {
      const diff = v - toNum(refPrefs[k]);
      if (diff > 0) delta[k] = diff;
    }

    // --- 今回のスナップショットを追記（30分粒度で貯まる。90日でトリム） ---
    history.push({ t: now.toISOString(), total, prefs: newPrefs });
    const keepFrom = now.getTime() - 90 * DAY;
    history = history.filter((s) => s && s.t && new Date(s.t).getTime() >= keepFrom);
    fs.writeFileSync(histPath, JSON.stringify(history) + "\n");

    const merged = {
      goal: remote.goal || base.goal || 1000,
      updated: "auto",
      prefs: newPrefs,
      delta,
    };
    fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2) + "\n");
    const upN = Object.keys(delta).length;
    console.log(`data.json 更新: 合計 ${total}人 / 24hで増えた県 ${upN} / 履歴 ${history.length}点`);
  } catch (e) {
    console.error("取得失敗（既存 data.json を保持）:", e.message);
    process.exitCode = 0; // パイプラインは止めない
  }
})();
