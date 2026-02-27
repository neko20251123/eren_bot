const fs = require("node:fs");
const path = require("node:path");

const DATA_PATH = path.join(__dirname, "data.json");

let cache = {};

// 起動時ロード
function load() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), "utf8");
      cache = {};
      return;
    }
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    cache = raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("store.load error:", e);
    cache = {};
  }
}

// 安全に保存（同期で確実に書く）
function flush() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.error("store.flush error:", e);
  }
}

// public
function getIntro(userId) {
  const v = cache[String(userId)];
  if (!v) return null;

  // 将来拡張してオブジェクト形式にしても崩れないように
  if (typeof v === "string") return v;
  if (typeof v?.intro === "string") return v.intro;

  return null;
}

async function saveIntro(userId, introText) {
  const key = String(userId);
  const text = String(introText ?? "").trim();

  // 空なら保存しない（事故防止）
  if (!text) return false;

  cache[key] = text;
  flush();
  return true;
}

function count() {
  return Object.keys(cache).length;
}

load();

module.exports = {
  getIntro,
  saveIntro,
  count,
};