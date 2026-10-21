/* =========================================================
   두 페이지가 함께 쓰는 도우미 함수
   ========================================================= */

// 구역 페이지 주소: district.html?d=haeundae
function districtUrl(d) {
  return "district.html?d=" + encodeURIComponent(d.en.toLowerCase());
}

// 카드 설명을 한 줄로: 네이버 리뷰 한 줄이 있으면 그 문구만, 없으면 첫 문장만
function shortDesc(desc) {
  const review = desc.match(/“([^”]+)”/);
  if (review) return review[1];
  return desc.split(/\.\s/)[0].replace(/\.$/, "");
}

// 카드 사진: img 칸이 있으면 그 파일, 없으면 images/장소이름.jpg → .png 순서로 찾아요.
// 사진 파일이 없으면 지금처럼 색깔 + 아이콘만 보여요.
function photoHTML(p) {
  const src = p.img || "images/" + encodeURIComponent(p.name) + ".jpg";
  const onError = p.img
    ? "this.remove()"
    : "if (!this.dataset.png) { this.dataset.png = 1; this.src = this.src.replace(/\.jpg$/, '.png'); } else this.remove()";
  // imgPos: "70%" 처럼 쓰면 사진의 더 아래쪽이 보여요 ("85% 100%" 처럼 두 개 쓰면 가로·세로 위치)
  // imgZoom: 1.3 처럼 쓰면 사진이 1.3배 확대돼요
  const styles = [];
  const pos = p.imgPos ? (p.imgPos.includes(" ") ? p.imgPos : "center " + p.imgPos) : "center";
  if (p.imgPos) styles.push(`object-position: ${pos}`);
  if (p.imgZoom) styles.push(`transform: scale(${p.imgZoom}); transform-origin: ${pos}`);
  // imgRange: [22, 84] 처럼 쓰면 사진의 22%~84% 높이 부분이 한 번에 다 보여요
  // (양옆 빈 곳은 같은 사진을 흐리게 깔아서 채워요)
  if (p.imgRange) {
    const [top, bottom] = p.imgRange;
    const span = bottom - top;
    const rangeStyle = `height: ${(100 * 100 / span).toFixed(1)}%; top: ${(-100 * top / span).toFixed(1)}%`;
    return `<img class="card-photo card-photo-bg" src="${src}" alt="" loading="lazy" onerror="${onError}">`
      + `<img class="card-photo card-photo-range" src="${src}" alt="" loading="lazy" style="${rangeStyle}" onerror="${onError}">`;
  }
  const style = styles.length ? ` style="${styles.join("; ")}"` : "";
  return `<img class="card-photo" src="${src}" alt="" loading="lazy"${style} onerror="${onError}">`;
}

// 검색: 띄어쓰기·대소문자 상관없이, 한 글자만 넣어도 그 글자가 들어간 곳을 모두 찾아요.
// 이름에 들어간 곳 → 동네·태그에 들어간 곳 순서로 돌려줘요.
function searchKey(s) {
  return String(s || "").replace(/\s+/g, "").toLowerCase();
}
// 다른 언어로 보고 있으면 번역된 이름·동네·태그로도 찾아요
function searchPlaces(places, query) {
  const q = searchKey(query);
  if (!q) return places;
  const both = s => typeof tr === "function" ? [s, tr(s)] : [s];
  const nameHit = p => [p.name, typeof placeName === "function" ? placeName(p) : p.name].some(n => searchKey(n).includes(q));
  const byName = places.filter(nameHit);
  const byOther = places.filter(p => !byName.includes(p) &&
    [p.area, ...(p.tags || [])].flatMap(both).some(t => searchKey(t).includes(q)));
  return [...byName, ...byOther];
}

// 검색 결과가 없을 때 보여줄 안내 (장소 추가 버튼 포함)
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}
function noResultHTML(query) {
  const q = escapeHTML(query);
  return `
    <div class="no-result">
      <p class="no-result-title">‘${q}’ 검색하신 장소가 없어요.</p>
      <p class="no-result-sub">찾으시는 장소를 VIVEDIVE에 추가할까요?</p>
      <button class="add-place-btn" type="button" data-q="${q}">+ 장소 추가하기</button>
    </div>`;
}
// 장소 추가 버튼: 장소 추가 신청 페이지로 이동 (검색어·보고 있던 구를 미리 채워 줘요)
document.addEventListener("click", e => {
  const btn = e.target.closest(".add-place-btn");
  if (!btn) return;
  const params = new URLSearchParams();
  if (btn.dataset.q) params.set("q", btn.dataset.q);
  const d = new URLSearchParams(location.search).get("d");
  if (d && location.pathname.endsWith("district.html")) params.set("d", d);
  const qs = params.toString();
  location.href = "add.html" + (qs ? "?" + qs : "");
});

// 관리자가 승인한 회원 추천 장소를 그 구에 더해요 (승인 전에는 안 보여요)
const REQUESTS_KEY = "tripdive.requests";
const DEFAULT_VIBE = { food: ["로컬", "핫플", "정크"], cafe: ["트렌디", "힐링", "정크"], spot: ["로컬", "힐링", "웰니스"] };
function getRequests() { return readStore(REQUESTS_KEY, []); }
function placeFromRequest(r) {
  return {
    type: r.type, name: r.name,
    desc: r.reason, tags: ["회원 추천"],
    vibe: DEFAULT_VIBE[r.type] || DEFAULT_VIBE.spot,
    addr: r.addr, query: r.addr + " " + r.name,
    userAdded: true, by: r.userNick,
  };
}
getRequests().filter(r => r.status === "승인").forEach(r => {
  const d = districts.find(d => d.name === r.district);
  if (d && !d.places.some(p => p.name === r.name)) d.places.push(placeFromRequest(r));
});

// 장소마다 어느 구인지 적어 둬요 (즐겨찾기에서 장소를 찾을 때 써요)
districts.forEach(d => d.places.forEach(p => { p.slug = d.en.toLowerCase(); p.districtName = d.name; }));
function favKey(p) { return p.slug + "|" + p.name; }

// 장소 카드 한 장 만들기
function cardHTML(p, i) {
  // placeId가 있으면 네이버 지도의 그 장소로 바로, 없으면 query(없으면 이름)로 검색
  const mapUrl = p.placeId
    ? "https://map.naver.com/p/entry/place/" + p.placeId
    : "https://map.naver.com/p/search/" + encodeURIComponent(p.query || "부산 " + p.name);
  return `
    <article class="card" style="animation-delay:${Math.min(i, 20) * 0.02}s">
      <div class="card-visual ${p.type}">
        ${photoHTML(p)}
        ${favButtonHTML(p)}
        <span class="card-badge">${categories[p.type].label}</span>
        ${categories[p.type].icon}
        <span class="card-vibe">${p.vibe.join(" · ")}</span>
      </div>
      <div class="card-body">
        <h3 data-noi18n>${typeof placeName === "function" ? placeName(p) : p.name}</h3>
        <p title="${p.desc}">${shortDesc(p.desc)}</p>
        ${p.addr ? `<p class="card-addr" data-noi18n>${p.addr}</p>` : ""}
        <a class="map-link" href="${mapUrl}" target="_blank">지도에서 보기 →</a>
      </div>
    </article>`;
}

// 왼쪽 메뉴: ☰ 버튼을 누르면 구역 목록이 왼쪽에서 열려요
(function setupSideMenu() {
  const btn = document.querySelector(".menu-btn");
  if (!btn) return;
  const current = new URLSearchParams(location.search).get("d");

  const overlay = document.createElement("div");
  overlay.className = "side-overlay";
  const menu = document.createElement("aside");
  menu.className = "side-menu";
  menu.innerHTML = `
    <div class="side-head">
      <span class="logo">VIVEDIVE</span>
      <button class="side-close" type="button" aria-label="메뉴 닫기">✕</button>
    </div>
    <a class="side-home" href="index.html">메인으로</a>
    <a class="side-home${location.pathname.endsWith("faq.html") ? " active" : ""}" href="faq.html">자주 묻는 질문</a>
    <p class="side-label">구역별 가이드</p>
    <ul class="side-list">
      ${districts.map(d => `
        <li><a href="${districtUrl(d)}"${d.en.toLowerCase() === current ? ' class="active"' : ""}>
          <strong>${d.name}</strong><span>${d.en}</span><em>${d.places.length}곳</em>
        </a></li>`).join("")}
    </ul>
    <a class="side-add${location.pathname.endsWith("add.html") ? " active" : ""}" href="add.html">+ 원하는 장소 추가</a>`;
  document.body.append(overlay, menu);

  const open = () => document.body.classList.add("menu-open");
  const close = () => document.body.classList.remove("menu-open");
  btn.addEventListener("click", open);
  overlay.addEventListener("click", close);
  menu.querySelector(".side-close").addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

/* =========================================================
   회원가입 · 로그인 (서버가 없어서 이 브라우저에만 저장되는 시연용이에요)
   ========================================================= */
const USERS_KEY = "tripdive.users";
const SESSION_KEY = "tripdive.session";
// 이 닉네임으로 가입한 계정이 관리자예요. 한 번 관리자로 확인되면 닉네임을 바꿔도 관리자로 남아요.
const ADMIN_NICKS = ["홍해"];

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (err) { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (err) { return false; }
}

// 비밀번호는 그대로 저장하지 않고 바꿔서(해시) 저장해요
async function hashPassword(id, pw) {
  const text = id + ":" + pw + ":tripdive";
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return "x" + h;
}

function getUsers() { return readStore(USERS_KEY, []); }
function currentUser() {
  const id = readStore(SESSION_KEY, null);
  return id ? getUsers().find(u => u.id === id) || null : null;
}
function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (err) {}
  location.reload();
}

// 로그인·회원가입 페이지로 갈 때 지금 페이지로 다시 돌아오게 주소를 붙여요
function authUrl(page) {
  const here = location.pathname.split("/").pop() + location.search;
  return page + "?next=" + encodeURIComponent(here || "index.html");
}

// 오른쪽 위: 로그인 전엔 [로그인] [회원가입], 로그인 후엔 [OO님] [로그아웃]
(function setupAuthNav() {
  const nav = document.querySelector(".hero-nav, .topbar");
  if (!nav) return;
  const right = document.createElement("div");
  right.className = "nav-right";
  const old = nav.querySelector(".issue, .back-link");
  if (old) right.append(old);

  const user = currentUser();
  const auth = document.createElement("div");
  auth.className = "auth-nav";
  auth.innerHTML = user
    ? `<a class="auth-user" href="mypage.html">${escapeHTML(user.nick)}님</a>
       <button class="auth-btn" type="button" id="logoutBtn">로그아웃</button>`
    : `<a class="auth-link" href="${authUrl("login.html")}">로그인</a>
       <a class="auth-btn" href="${authUrl("signup.html")}">회원가입</a>`;
  right.append(auth);
  nav.append(right);

  const btn = auth.querySelector("#logoutBtn");
  if (btn) btn.addEventListener("click", logout);

  // 관리자는 닉네임 옆에 [관리자] 버튼
  if (isAdmin(user)) {
    auth.insertAdjacentHTML("afterbegin", `<a class="admin-badge" href="admin.html">관리자</a>`);
  }

  // 왼쪽 메뉴에도 마이페이지 (로그인했을 때만), 관리자 페이지 (관리자만)
  const here = location.pathname.split("/").pop();
  const faqLink = document.querySelector(".side-menu a[href=\"faq.html\"]");
  if (user && faqLink) {
    faqLink.insertAdjacentHTML("afterend",
      `<a class="side-home${here === "mypage.html" ? " active" : ""}" href="mypage.html">마이페이지</a>`
      + (isAdmin(user) ? `<a class="side-home side-admin${here === "admin.html" ? " active" : ""}" href="admin.html">관리자 페이지</a>` : ""));
  }
})();

/* =========================================================
   즐겨찾기 (회원마다 따로 저장해요)
   ========================================================= */
function favStoreKey(user) { return "tripdive.favs." + user.id; }
function getFavs(user = currentUser()) { return user ? readStore(favStoreKey(user), []) : []; }
function setFavs(list, user = currentUser()) { if (user) writeStore(favStoreKey(user), list); }
function favButtonHTML(p) {
  const key = favKey(p);
  const on = getFavs().includes(key);
  return `<button class="fav-btn${on ? " on" : ""}" type="button" data-fav="${escapeHTML(key)}"
    aria-pressed="${on}" aria-label="${escapeHTML(typeof placeName === "function" ? placeName(p) : p.name)} 즐겨찾기" title="즐겨찾기">${heartIcon()}</button>`;
}
function heartIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.5 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>`;
}
document.addEventListener("click", e => {
  const btn = e.target.closest(".fav-btn");
  if (!btn) return;
  const user = currentUser();
  if (!user) {
    if (confirm("즐겨찾기는 로그인한 회원만 쓸 수 있어요. 로그인할까요?")) location.href = authUrl("login.html");
    return;
  }
  const key = btn.dataset.fav;
  const favs = getFavs(user);
  const on = !favs.includes(key);
  setFavs(on ? [...favs, key] : favs.filter(k => k !== key), user);
  // 같은 장소 카드가 화면에 여러 개 있어도 모두 바꿔요
  document.querySelectorAll(".fav-btn").forEach(b => {
    if (b.dataset.fav !== key) return;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
  document.dispatchEvent(new CustomEvent("favchange", { detail: { key, on } }));
});

/* =========================================================
   회원 정보에서 같이 쓰는 것들 (회원가입 · 마이페이지)
   ========================================================= */
// 이용 목적 항목 (여기에 한 줄 추가하면 선택지가 늘어나요)
const PURPOSES = [
  "부산 여행 계획", "일상 속 동네 탐방", "친구·지인에게 추천", "데이트 코스 찾기",
  "가족 나들이", "혼자 여행", "맛집 탐방", "카페 투어",
  "산책·등산 등 웰니스", "사진·인생샷 명소", "출장·업무 중 식사", "부산 이사·정착 준비",
  "수업·과제·발표", "숨은 장소 공유", "기타",
];
// 닉네임은 띄어쓰기·대소문자를 무시하고 비교해요 (exceptId: 내 계정은 빼고)
function normNick(t) { return String(t || "").replace(/\s+/g, "").toLowerCase(); }
function nickTaken(nick, exceptId) {
  // 관리자 닉네임은 관리자가 이미 있으면 다른 사람이 쓸 수 없어요
  // (회원 정보는 사이트 주소·브라우저마다 따로라서, 새 주소에서는 관리자가 처음 한 번 가입할 수 있어야 해요)
  if (ADMIN_NICKS.some(a => normNick(a) === normNick(nick))) {
    const adminExists = getUsers().some(u => u.id !== exceptId &&
      (u.role === "admin" || ADMIN_NICKS.some(a => normNick(a) === normNick(u.nick))));
    if (adminExists) return true;
  }
  return getUsers().some(u => u.id !== exceptId && normNick(u.nick) === normNick(nick));
}

/* =========================================================
   관리자
   ========================================================= */
// 관리자 닉네임(ADMIN_NICKS)은 위쪽 회원가입·로그인 부분에 있어요.
function isAdmin(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!ADMIN_NICKS.some(a => normNick(a) === normNick(user.nick))) return false;
  // 처음 확인될 때 계정에 관리자 표시를 남겨요
  const users = getUsers();
  const me = users.find(u => u.id === user.id);
  if (me) { me.role = "admin"; writeStore(USERS_KEY, users); }
  user.role = "admin";
  return true;
}
