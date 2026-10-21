/* =========================================================
   VIVEDIVE 서버 (Vercel 함수)
   - 회원과 장소 추천 신청을 Vercel Blob(비공개 저장소)의 db.json 한 파일에 모아 저장해요.
   - 그래서 누가 어디서 가입하든 관리자 페이지에 모두 보여요.
   - 사이트는 POST /api/db  { action: "...", ...내용 } 으로 요청해요.
   - 비밀번호는 브라우저에서 바꾼(해시) 값만 받아 저장해요.
   ========================================================= */
const crypto = require("crypto");
const { get, head, put, BlobPreconditionFailedError } = require("@vercel/blob");

const DB_PATH = "db.json";
const ADMIN_NICKS = ["홍해"];
const SECRET = process.env.SESSION_SECRET || "";

/* ---------- 저장소 읽기·쓰기 ---------- */
async function readDb() {
  const r = await get(DB_PATH, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return { db: { users: [], requests: [] }, etag: null };
  const text = await new Response(r.stream).text();
  let etag = r.blob && r.blob.etag;
  if (!etag) etag = (await head(DB_PATH)).etag;
  const db = JSON.parse(text || "{}");
  db.users = db.users || [];
  db.requests = db.requests || [];
  return { db, etag };
}
// 바꾸기: 그사이 다른 사람이 먼저 저장했으면 다시 읽어서 다시 해요
async function updateDb(change) {
  for (let i = 0; i < 6; i++) {
    const { db, etag } = await readDb();
    const result = change(db);
    if (result && result.error) return result;
    try {
      await put(DB_PATH, JSON.stringify(db), {
        access: "private", contentType: "application/json",
        addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return result;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError || /precondition/i.test(err.message)) continue;
      throw err;
    }
  }
  return { error: "busy" };
}

/* ---------- 로그인 표 (토큰) ---------- */
function sign(id) {
  return crypto.createHmac("sha256", SECRET).update(String(id)).digest("base64url");
}
function makeToken(id) { return Buffer.from(String(id)).toString("base64url") + "." + sign(id); }
function tokenUser(db, token) {
  if (!token || typeof token !== "string") return null;
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return null;
  const id = Buffer.from(raw, "base64url").toString();
  const want = sign(id);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  return db.users.find(u => u.id === id) || null;
}

/* ---------- 도우미 ---------- */
const norm = t => String(t || "").replace(/\s+/g, "").toLowerCase();
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const isAdminNick = nick => ADMIN_NICKS.some(a => norm(a) === norm(nick));
// 화면에 보내도 되는 회원 정보 (비밀번호 해시는 빼요)
function publicUser(u) {
  const { pw, ...rest } = u;
  return { ...rest, hasPw: !!pw };
}
function nickTaken(db, nick, exceptId) {
  if (isAdminNick(nick) && db.users.some(u => u.id !== exceptId && (u.role === "admin" || isAdminNick(u.nick)))) return true;
  return db.users.some(u => u.id !== exceptId && norm(u.nick) === norm(nick));
}
function profileFrom(body) {
  const purposes = Array.isArray(body.purposes) ? body.purposes.map(p => str(p, 40)).filter(Boolean).slice(0, 20) : [];
  return {
    name: str(body.name, 20), nick: str(body.nick, 12), addr: str(body.addr, 80),
    age: str(body.age, 20), source: str(body.source, 40),
    purposes, purposeEtc: purposes.includes("기타") ? str(body.purposeEtc, 40) : "",
  };
}
function profileProblem(p) {
  if (p.name.length < 2) return "이름을 입력해 주세요.";
  if (p.nick.length < 2) return "닉네임은 2자 이상 입력해 주세요.";
  if (p.addr.length < 2) return "주소를 입력해 주세요.";
  if (!p.purposes.length) return "이용 목적을 하나 이상 골라 주세요.";
  return "";
}
const isHash = h => typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
function publicRequest(r) {
  return { district: r.district, type: r.type, name: r.name, addr: r.addr, reason: r.reason, userNick: r.userNick, status: r.status };
}
const reqKey = r => r.userId + "|" + r.createdAt;

/* ---------- 요청 처리 ---------- */
const actions = {
  // 승인된 장소 (누구나)
  async approved() {
    const { db } = await readDb();
    return { places: db.requests.filter(r => r.status === "승인").map(publicRequest) };
  },

  async checkId({ id }) {
    id = str(id, 40).toLowerCase();
    if (!/^[a-z0-9]{4,20}$/.test(id)) return { ok: false, error: "아이디는 영문 소문자와 숫자로 4~20자 입력해 주세요." };
    const { db } = await readDb();
    if (db.users.some(u => u.id === id)) return { ok: false, error: "이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요." };
    return { ok: true };
  },

  async checkNick({ nick, token }) {
    nick = str(nick, 12);
    if (nick.length < 2) return { ok: false, error: "닉네임은 2자 이상 입력해 주세요." };
    const { db } = await readDb();
    const me = tokenUser(db, token);
    if (nickTaken(db, nick, me && me.id)) return { ok: false, error: "이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요." };
    return { ok: true };
  },

  // 회원가입 (아이디 가입 또는 네이버·카카오 가입)
  async signup(body) {
    const p = profileFrom(body);
    const problem = profileProblem(p);
    if (problem) return { error: problem };
    let id, pw = null, provider = "id";
    if (body.provider === "naver" || body.provider === "kakao") {
      provider = body.provider;
      const sid = str(body.socialId, 80).replace(/[^\w-]/g, "");
      if (!sid) return { error: "로그인 정보가 없어요. 로그인 화면에서 다시 시도해 주세요." };
      id = provider + "_" + sid;
    } else {
      id = str(body.id, 40).toLowerCase();
      if (!/^[a-z0-9]{4,20}$/.test(id)) return { error: "아이디는 영문 소문자와 숫자로 4~20자 입력해 주세요." };
      if (!isHash(body.pwHash)) return { error: "비밀번호는 8자 이상 입력해 주세요." };
      pw = body.pwHash;
    }
    return updateDb(db => {
      if (db.users.some(u => u.id === id)) return { error: provider === "id" ? "이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요." : "이미 가입된 계정이에요. 로그인해 주세요." };
      if (nickTaken(db, p.nick)) return { error: "이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요." };
      const user = { id, ...p, provider, createdAt: new Date().toISOString() };
      if (pw) user.pw = pw;
      if (isAdminNick(p.nick)) user.role = "admin"; // 관리자 닉네임 (위 nickTaken 에서 관리자가 이미 있으면 막혀요)
      db.users.push(user);
      return { token: makeToken(id), user: publicUser(user) };
    });
  },

  async login({ id, pwHash }) {
    id = str(id, 40).toLowerCase();
    const { db } = await readDb();
    const user = db.users.find(u => u.id === id);
    if (!user || !user.pw || user.pw !== pwHash) return { error: "아이디 또는 비밀번호가 맞지 않아요." };
    return { token: makeToken(id), user: publicUser(user) };
  },

  // 네이버·카카오: 가입한 적 있으면 로그인, 없으면 가입하라고 알려 줘요
  async social({ provider, socialId }) {
    if (provider !== "naver" && provider !== "kakao") return { error: "로그인 정보가 없어요. 로그인 화면에서 다시 시도해 주세요." };
    const id = provider + "_" + str(socialId, 80).replace(/[^\w-]/g, "");
    const { db } = await readDb();
    const user = db.users.find(u => u.id === id);
    return user ? { token: makeToken(id), user: publicUser(user) } : { needSignup: true };
  },

  async me({ token }) {
    const { db } = await readDb();
    const user = tokenUser(db, token);
    return user ? { user: publicUser(user) } : { error: "login" };
  },

  async updateProfile(body) {
    const p = profileFrom(body);
    const problem = profileProblem(p);
    if (problem) return { error: problem };
    return updateDb(db => {
      const me = tokenUser(db, body.token);
      if (!me) return { error: "login" };
      if (nickTaken(db, p.nick, me.id)) return { error: "이미 사용 중인 닉네임이에요." };
      if (body.newPwHash) {
        if (!me.pw || me.pw !== body.curPwHash) return { error: "현재 비밀번호가 맞지 않아요.", field: "curPw" };
        if (!isHash(body.newPwHash)) return { error: "새 비밀번호는 8자 이상 입력해 주세요." };
        me.pw = body.newPwHash;
      }
      Object.assign(me, p);
      // 닉네임이 바뀌면 내 추천 신청에 적힌 닉네임도 함께 바꿔요
      db.requests.forEach(r => { if (r.userId === me.id) r.userNick = me.nick; });
      return { user: publicUser(me) };
    });
  },

  async deleteAccount({ token }) {
    return updateDb(db => {
      const me = tokenUser(db, token);
      if (!me) return { error: "login" };
      db.users = db.users.filter(u => u.id !== me.id);
      return { ok: true };
    });
  },

  async findId({ name, nick }) {
    const { db } = await readDb();
    const u = db.users.find(u => norm(u.name) === norm(name) && norm(u.nick) === norm(nick));
    if (!u) return { error: "입력한 정보와 맞는 회원이 없어요." };
    return { id: u.pw ? u.id : null, provider: u.provider };
  },

  // 비밀번호 재설정: 아이디 + 이름 + 닉네임이 모두 맞아야 해요
  async verifyReset({ id, name, nick }) {
    const { db } = await readDb();
    const u = db.users.find(u => u.id === str(id, 40).toLowerCase() && norm(u.name) === norm(name) && norm(u.nick) === norm(nick));
    if (!u) return { error: "입력한 정보와 맞는 회원이 없어요." };
    if (!u.pw) return { provider: u.provider };
    return { ok: true, nick: u.nick };
  },
  async resetPw({ id, name, nick, newPwHash }) {
    if (!isHash(newPwHash)) return { error: "새 비밀번호는 8자 이상 입력해 주세요." };
    return updateDb(db => {
      const u = db.users.find(u => u.id === str(id, 40).toLowerCase() && norm(u.name) === norm(name) && norm(u.nick) === norm(nick));
      if (!u || !u.pw) return { error: "입력한 정보와 맞는 회원이 없어요." };
      u.pw = newPwHash;
      return { ok: true };
    });
  },

  // 장소 추천 신청
  async addRequest(body) {
    const req = {
      district: str(body.district, 10), type: ["food", "cafe", "spot"].includes(body.type) ? body.type : "",
      name: str(body.name, 40), addr: str(body.addr, 80), reason: str(body.reason, 500),
    };
    if (!req.district || !req.type || !req.name || !req.addr || req.reason.length < 10) return { error: "입력한 내용을 확인해 주세요." };
    return updateDb(db => {
      const me = tokenUser(db, body.token);
      if (!me) return { error: "login" };
      db.requests.push({ ...req, userId: me.id, userNick: me.nick, status: "대기", createdAt: new Date().toISOString() });
      return { ok: true };
    });
  },
  async myRequests({ token }) {
    const { db } = await readDb();
    const me = tokenUser(db, token);
    if (!me) return { error: "login" };
    return { requests: db.requests.filter(r => r.userId === me.id) };
  },
  async cancelRequest({ token, createdAt }) {
    return updateDb(db => {
      const me = tokenUser(db, token);
      if (!me) return { error: "login" };
      db.requests = db.requests.filter(r => !(r.userId === me.id && r.createdAt === createdAt && r.status === "대기"));
      return { ok: true };
    });
  },

  // 관리자
  async adminData({ token }) {
    const { db } = await readDb();
    const me = tokenUser(db, token);
    if (!me || me.role !== "admin") return { error: "admin" };
    return { requests: db.requests, users: db.users.map(publicUser) };
  },
  // 관리자가 회원 탈퇴시키기 (관리자 본인은 여기서 못 지워요)
  async removeUser({ token, userId }) {
    return updateDb(db => {
      const me = tokenUser(db, token);
      if (!me || me.role !== "admin") return { error: "admin" };
      if (userId === me.id) return { error: "관리자 계정은 여기서 탈퇴시킬 수 없어요." };
      const before = db.users.length;
      db.users = db.users.filter(u => u.id !== userId);
      if (db.users.length === before) return { error: "notfound" };
      return { ok: true };
    });
  },

  async review({ token, key, status, reason }) {
    if (!["대기", "승인", "거절"].includes(status)) return { error: "status" };
    return updateDb(db => {
      const me = tokenUser(db, token);
      if (!me || me.role !== "admin") return { error: "admin" };
      const r = db.requests.find(r => reqKey(r) === key);
      if (!r) return { error: "notfound" };
      r.status = status;
      if (status === "거절") r.rejectReason = str(reason, 200); else delete r.rejectReason;
      if (status === "대기") { delete r.reviewedAt; delete r.reviewedBy; }
      else { r.reviewedAt = new Date().toISOString(); r.reviewedBy = me.nick; }
      return { ok: true };
    });
  },
};

module.exports = async (req, res) => {
  // GitHub Pages·내 컴퓨터에서 열어도 같은 저장소를 쓰도록 다른 주소의 요청도 받아요
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!SECRET) return res.status(500).json({ error: "SESSION_SECRET is not set" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const fn = actions[body.action];
    if (!fn) return res.status(400).json({ error: "unknown action" });
    res.status(200).json(await fn(body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server", detail: String(err && err.message || err) });
  }
};
