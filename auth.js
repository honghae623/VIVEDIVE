/* =========================================================
   네이버 · 카카오 간편 로그인 (login.html, signup.html 에서 써요)

   - keys.js 에 개발자센터 키를 넣고, 사이트를 http(s) 주소로 열면 진짜 로그인이에요.
     (파일을 더블클릭해서 file:// 로 열면 네이버·카카오가 막아요)
   - 키가 비어 있거나 file:// 로 열었으면 '시연 모드'로 동작해요.
   - 로그인을 마치면 네이버·카카오가 callback.html 로 돌려보내 줘요.
   ========================================================= */

const SOCIAL = {
  naver: { label: "네이버" },
  kakao: { label: "카카오" },
};
const PENDING_KEY = "tripdive.pendingSocial";
const NEXT_KEY = "tripdive.socialNext";
const CALLBACK_URL = location.origin + location.pathname.replace(/[^/]*$/, "") + "callback.html";

// 진짜 로그인을 쓸 수 있는지 (키가 있고, http(s) 주소로 열었을 때)
function realLogin(provider) {
  if (!/^https?:$/.test(location.protocol)) return false;
  if (provider === "naver") return typeof NAVER_CLIENT_ID === "string" && NAVER_CLIENT_ID.trim() !== "";
  if (provider === "kakao") return typeof KAKAO_REST_KEY === "string" && KAKAO_REST_KEY.trim() !== "";
  return false;
}

// 로그인 후 돌아갈 페이지 (같은 사이트 안의 페이지만 허용)
const nextRaw = new URLSearchParams(location.search).get("next") || "index.html";
let next = /^[\w.-]+\.html(\?[^#]*)?$/.test(nextRaw) ? nextRaw : "index.html";

// 시연 모드: 이 브라우저의 '가상 네이버/카카오 계정' 번호 (한 번 만들면 계속 같은 번호)
function demoSocialId(provider) {
  const key = "tripdive.demoSocial." + provider;
  let sid = readStore(key, null);
  if (!sid) {
    sid = Math.random().toString(36).slice(2, 10);
    writeStore(key, sid);
  }
  return provider + "_" + sid;
}

// 간편 로그인 버튼을 눌렀을 때
function socialLogin(provider) {
  if (!realLogin(provider)) return openDemoDialog(provider);
  try { sessionStorage.setItem(NEXT_KEY, next); } catch (err) {}
  if (provider === "kakao") {
    location.href = "https://kauth.kakao.com/oauth/authorize?response_type=code"
      + "&client_id=" + encodeURIComponent(KAKAO_REST_KEY.trim())
      + "&redirect_uri=" + encodeURIComponent(CALLBACK_URL)
      + "&state=kakao";
  } else {
    naverLoginStart();
  }
}

// 네이버 공식 스크립트를 불러와요
function loadNaverSdk() {
  return new Promise((resolve, reject) => {
    if (window.naver && naver.LoginWithNaverId) return resolve();
    const sc = document.createElement("script");
    sc.src = "https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js";
    sc.onload = resolve;
    sc.onerror = () => reject(new Error("네이버 로그인 스크립트를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."));
    document.head.append(sc);
  });
}
function makeNaverLogin() {
  let box = document.getElementById("naverIdLogin");
  if (!box) {
    box = document.createElement("div");
    box.id = "naverIdLogin";
    box.hidden = true;
    document.body.append(box);
  }
  const nl = new naver.LoginWithNaverId({
    clientId: NAVER_CLIENT_ID.trim(),
    callbackUrl: CALLBACK_URL,
    isPopup: false,
    loginButton: { color: "green", type: 1, height: 40 },
  });
  nl.init();
  return nl;
}
// 네이버 스크립트가 만든 (숨은) 공식 로그인 버튼을 대신 눌러요
async function naverLoginStart() {
  try {
    await loadNaverSdk();
    makeNaverLogin();
    document.getElementById("naverIdLogin_loginButton").click();
  } catch (err) {
    alert(err.message);
  }
}

// 시연 모드 안내 창
function openDemoDialog(provider) {
  const label = SOCIAL[provider].label;
  const wrap = document.createElement("div");
  wrap.className = "demo-dialog-wrap";
  wrap.innerHTML = `
    <div class="demo-dialog" role="dialog" aria-modal="true" aria-labelledby="demoTitle">
      <span class="social-mark ${provider}">${provider === "naver" ? "N" : kakaoIcon()}</span>
      <h2 id="demoTitle">${label} 계정으로 계속할까요?</h2>
      <p>지금은 <b>시연 모드</b>예요. 실제 ${label} 로그인 창 대신, ${label} 계정으로 로그인한 것처럼 처리해요.</p>
      <p class="demo-note">사이트를 인터넷에 올리고 ${label} 개발자센터 키를 넣으면 진짜 ${label} 로그인으로 바뀌어요.</p>
      <div class="demo-btns">
        <button type="button" class="pick-more" data-act="cancel">취소</button>
        <button type="button" class="social-btn ${provider}" data-act="ok">${label}로 계속하기</button>
      </div>
    </div>`;
  document.body.append(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener("click", e => {
    if (e.target === wrap || e.target.dataset.act === "cancel") close();
    if (e.target.closest("[data-act=ok]")) { close(); finishSocial(provider); }
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
  wrap.querySelector("[data-act=ok]").focus();
}

// 연동이 끝난 뒤: 이미 가입한 계정이면 바로 로그인, 처음이면 회원 정보 설문으로
// profile: 진짜 로그인이면 { id, name, nick } (네이버·카카오가 알려 준 정보), 시연 모드면 없음
async function finishSocial(provider, profile) {
  const socialId = profile ? String(profile.id) : demoSocialId(provider).slice(provider.length + 1);
  let r;
  try { r = await api("social", { provider, socialId }); }
  catch (err) { alert(SERVER_DOWN); return; }
  if (r.token) {
    saveSession(r.token, r.user);
    location.href = next;
    return;
  }
  const pending = { provider, socialId, name: (profile && profile.name) || "", nick: (profile && profile.nick) || "" };
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (err) {}
  location.href = "signup.html?social=" + provider + "&next=" + encodeURIComponent(next);
}

function kakaoIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.4 0 .9.1 1.3.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>`;
}

// 간편 로그인 버튼 두 개 그리기
function renderSocialButtons(el, verb) {
  el.innerHTML = `
    <button type="button" class="social-btn naver" data-provider="naver"><span class="social-icon">N</span>네이버로 ${verb}</button>
    <button type="button" class="social-btn kakao" data-provider="kakao"><span class="social-icon">${kakaoIcon()}</span>카카오로 ${verb}</button>`;
  el.addEventListener("click", e => {
    const btn = e.target.closest("[data-provider]");
    if (btn) socialLogin(btn.dataset.provider);
  });
}
