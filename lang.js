/* =========================================================
   다국어 (한국어 · English · 日本語 · 中文)
   - 오른쪽 위 언어 선택에서 고르면 이 브라우저에 기억해요.
   - 주소 뒤에 ?lang=en 처럼 붙여도 그 언어로 열려요. (ko / en / ja / zh)
   - 번역 문장은 lang-data.js 에 있어요. (한국어 문장 → [영어, 일본어, 중국어])
   - 화면에 보이는 한국어 글자를 찾아 사전에 있는 번역으로 바꿔 끼우는 방식이에요.
     사전에 없는 글자(가게 이름, 회원이 쓴 글 등)는 한국어 그대로 보여요.
   ========================================================= */

const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];
const LANG_KEY = "vivedive.lang";
const LANG = (() => {
  const ok = c => LANGS.some(l => l.code === c);
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (ok(fromUrl)) {
    try { localStorage.setItem(LANG_KEY, fromUrl); } catch (err) {}
    return fromUrl;
  }
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (err) {}
  return ok(saved) ? saved : "ko";
})();
const LANG_INDEX = { en: 0, ja: 1, zh: 2 }[LANG];
document.documentElement.lang = LANG === "zh" ? "zh-CN" : LANG;

// 사전에서 바로 찾기
function lookup(s) {
  const row = LANG_DICT[s];
  return row ? row[LANG_INDEX] : null;
}

// 글자를 바꿔 끼울 수 있는 문장 틀 (이름·숫자 같은 바뀌는 부분이 있는 문장)
// [정규식, { en, ja, zh }]  — $1, $2 는 그대로, {1}, {2} 는 그 부분도 번역해서 넣어요.
const LANG_PATTERNS = [
  [/^(\d+)곳 전체 보기 →$/, { en: "See all $1 →", ja: "全$1件を見る →", zh: "查看全部$1处 →" }],
  [/^(.+) (\d+%)$/, { en: "{1} $2", ja: "{1} $2", zh: "{1} $2" }],
  [/^(.+)님, 가입을 환영해요!$/, { en: "Welcome, $1!", ja: "$1さん、ようこそ！", zh: "$1，欢迎加入！" }],
  [/^(\d+)곳$/, { en: "$1 places", ja: "$1件", zh: "$1处" }],
  [/^‘(.*)’ 검색 결과 (\d+)곳$/, { en: "$2 results for ‘$1’", ja: "「$1」の検索結果 $2件", zh: "“$1”的搜索结果：$2处" }],
  [/^‘(.*)’ 검색하신 장소가 없어요\.$/, { en: "No places found for ‘$1’.", ja: "「$1」に一致する場所はありません。", zh: "没有找到“$1”相关的地点。" }],
  [/^막대는 (.+)의 분위기예요\. 체크하면 취향에 맞는 곳만 보여드려요\.$/, {
    en: "The bars show the vibe of {1}. Check boxes to see only places that match your taste.",
    ja: "バーは{1}の雰囲気です。チェックすると好みに合う場所だけを表示します。",
    zh: "条形图显示{1}的氛围。勾选后只显示符合你喜好的地点。" }],
  [/^(.+) 취향에 맞는 곳: (\d+)곳$/, { en: "Places matching {1}: $2", ja: "{1}に合う場所：$2件", zh: "符合{1}的地点：$2处" }],
  [/^이 구역의 (.+) 정보는 준비 중이에요\.$/, { en: "{1} for this district are coming soon.", ja: "このエリアの{1}情報は準備中です。", zh: "本区的{1}信息正在准备中。" }],
  [/^(.+)님으로 신청해요$/, { en: "Submitting as $1", ja: "$1さんとして申請します", zh: "以$1的身份提交" }],
  [/^(.+)님$/, { en: "$1", ja: "$1さん", zh: "$1" }],
  [/^(.+)을\(를\) 확인해 주세요\.$/, { en: "Please check: {1}.", ja: "{1}を確認してください。", zh: "请检查：{1}。" }],
  [/^(네이버|카카오) 계정이 연결됐어요\. 아래 정보만 입력하면 가입이 끝나요\.$/, {
    en: "Your {1} account is connected. Just fill in the details below to finish signing up.",
    ja: "{1}アカウントが連携されました。下の情報を入力すれば登録完了です。",
    zh: "{1}账号已关联。填写以下信息即可完成注册。" }],
  [/^‘(.*)’는 사용할 수 있는 아이디예요\.$/, { en: "‘$1’ is available.", ja: "「$1」は使用できるIDです。", zh: "“$1”可以使用。" }],
  [/^‘(.*)’는 사용할 수 있는 닉네임이에요\.$/, { en: "‘$1’ is available.", ja: "「$1」は使用できるニックネームです。", zh: "“$1”可以使用。" }],
  [/^(네이버|카카오) 계정으로 로그인해요$/, { en: "You sign in with {1}", ja: "{1}アカウントでログインします", zh: "使用{1}账号登录" }],
  [/^(네이버|카카오) 계정으로 계속할까요\?$/, { en: "Continue with {1}?", ja: "{1}アカウントで続けますか？", zh: "使用{1}账号继续吗？" }],
  [/^지금은 시연 모드예요\. 실제 (네이버|카카오) 로그인 창 대신, (?:네이버|카카오) 계정으로 로그인한 것처럼 처리해요\.$/, {
    en: "This is <b>demo mode</b>. Instead of the real {1} login window, it acts as if you signed in with {1}.",
    ja: "現在は<b>デモモード</b>です。実際の{1}ログイン画面の代わりに、{1}アカウントでログインしたものとして処理します。",
    zh: "当前为<b>演示模式</b>。不会打开真正的{1}登录窗口，而是模拟使用{1}账号登录。" }],
  [/^사이트를 인터넷에 올리고 (네이버|카카오) 개발자센터 키를 넣으면 진짜 (?:네이버|카카오) 로그인으로 바뀌어요\.$/, {
    en: "Once the site is online with a {1} developer key, this becomes a real {1} login.",
    ja: "サイトを公開して{1}デベロッパーキーを設定すると、本物の{1}ログインになります。",
    zh: "网站上线并填入{1}开发者密钥后，就会变成真正的{1}登录。" }],
  [/^(네이버|카카오)로 계속하기$/, { en: "Continue with {1}", ja: "{1}で続ける", zh: "使用{1}继续" }],
  [/^(네이버|카카오)로 (로그인|가입하기)$/, { en: "{2} with {1}", ja: "{1}で{2}", zh: "{1}{2}" }],
  [/^(.+) 즐겨찾기$/, { en: "Save $1", ja: "$1をお気に入り", zh: "收藏$1" }],
  [/^(.+) · VIVEDIVE$/, { en: "{1} · VIVEDIVE", ja: "{1} · VIVEDIVE", zh: "{1} · VIVEDIVE" }],
  [/^(\d{4})\. (\d{1,2})\. (\d{1,2})\. 신청$/, { en: "Submitted $2/$3/$1", ja: "$1/$2/$3 申請", zh: "$1/$2/$3 提交" }],
  [/^반려 사유: (.*)$/, { en: "Reason for rejection: $1", ja: "差し戻し理由：$1", zh: "驳回原因：$1" }],
  [/^(\d{4})\. (\d{1,2})\. (\d{1,2})\.$/, { en: "$2/$3/$1", ja: "$1/$2/$3", zh: "$1/$2/$3" }],
  [/^(\d{4})\. (\d{1,2})\. (\d{1,2})\. 가입$/, { en: "Joined $2/$3/$1", ja: "$1/$2/$3 登録", zh: "$1/$2/$3 注册" }],
  [/^카카오 인증에 실패했어요\. \((.*)\)$/, { en: "Kakao sign-in failed. ($1)", ja: "カカオ認証に失敗しました。（$1）", zh: "Kakao认证失败。（$1）" }],
  [/^로그인 중 문제가 생겼어요\. \((.*)\)$/, { en: "Something went wrong while signing in. ($1)", ja: "ログイン中に問題が発生しました。（$1）", zh: "登录时出现问题。（$1）" }],
];

// 장소 설명 틀: "해변·구남로의 일식당. 네이버 리뷰 한 줄: “…”"
const DESC_RE = /^(.+?)의 (.+?)(?:\.(?: 네이버 리뷰 한 줄: “(.+)”)?)?$/;
const DESC_FMT = {
  en: (a, c) => `${c} in ${a}`, ja: (a, c) => `${a}の${c}`, zh: (a, c) => `${a}的${c}`,
};
const REVIEW_FMT = { en: q => ` Naver review: “${q}”`, ja: q => `NAVERレビュー：「${q}」`, zh: q => `NAVER评论：“${q}”` };
const STOP = { en: ".", ja: "。", zh: "。" };

// 한국어 문장 하나를 지금 언어로 (모르면 null)
function translate(s) {
  if (LANG === "ko" || s == null) return null;
  s = String(s);
  if (!/[가-힣]/.test(s)) return null;
  const hit = lookup(s);
  if (hit != null) return hit;

  for (const [re, fmt] of LANG_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    return fmt[LANG]
      .replace(/\{(\d)\}/g, (_, i) => translate(m[i]) ?? m[i])
      .replace(/\$(\d)/g, (_, i) => m[i]);
  }

  // 장소 설명 틀
  const d = s.match(DESC_RE);
  if (d) {
    const keep = x => translate(x) ?? (/[가-힣]/.test(x) ? null : x);
    const area = keep(d[1]), cat = keep(d[2]);
    if (area && cat) {
      let out = DESC_FMT[LANG](area, cat);
      if (d[3]) out += STOP[LANG] + REVIEW_FMT[LANG](lookup(d[3]) ?? d[3]);
      return out;
    }
  }

  // 마침표 없는 첫 문장 (카드 한 줄 설명)
  const withStop = lookup(s + ".");
  if (withStop != null) return withStop.replace(/[.。]$/, "");

  // "로컬 · 핫플 · 정크", "해변·구남로" 처럼 나뉜 것은 하나씩
  for (const sep of [" · ", "·", ", "]) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep).map(p => p.trim() ? translate(p.trim()) ?? (/[가-힣]/.test(p) ? null : p) : p);
    if (parts.every(p => p != null)) return parts.join(sep === "·" ? " · " : sep);
  }

  // 여러 문장이면 문장마다
  const sentences = s.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) {
    const parts = sentences.map(translate);
    if (parts.every(p => p != null)) return parts.join(LANG === "en" ? " " : "");
  }
  return null;
}
// 번역이 있으면 번역, 없으면 원래 글자
function tr(s) { return translate(s) ?? s; }

// 장소 이름: 관광지는 번역 이름, 가게는 한국어 이름 그대로 (현지 간판·지도 검색에 그대로 쓰여서)
function placeName(p) {
  if (LANG === "ko" || p.type !== "spot") return p.name;
  return lookup(p.name) ?? p.name;
}

/* ---------- 화면 바꾸기 ---------- */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SVG", "PATH"]);
const INLINE_ONLY = "b, strong, em, i, br, small";
const ATTRS = ["placeholder", "title", "aria-label", "alt"];

function skipped(el) {
  return !el || el.closest("[data-noi18n], .lang-switch") != null;
}

function translateText(node) {
  const raw = node.nodeValue;
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return;
  const t = translate(s);
  if (t == null) return;
  const lead = raw.match(/^\s*/)[0] ? " " : "", tail = raw.match(/\s*$/)[0] ? " " : "";
  node.nodeValue = lead + t + tail;
}

function translateAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) { const t = translate(v.trim()); if (t != null) el.setAttribute(a, t.replace(/<[^>]+>/g, "")); }
  }
}

// 글자 사이에 <b> 같은 꾸밈 태그가 끼어 있는 문단은 문단 전체를 한 번에 번역해요
function translateBlock(el) {
  if (!el.children.length || el.querySelector(`:scope *:not(${INLINE_ONLY})`)) return false;
  const s = el.textContent.replace(/\s+/g, " ").trim();
  const t = translate(s);
  if (t == null) return false;
  el.innerHTML = t;
  return true;
}

function translateTree(root) {
  if (LANG === "ko" || !root) return;
  if (root.nodeType === 3) { if (!skipped(root.parentElement)) translateText(root); return; }
  if (root.nodeType !== 1 || SKIP_TAGS.has(root.tagName.toUpperCase()) || skipped(root)) {
    if (root.nodeType === 1 && /^(INPUT|TEXTAREA)$/.test(root.tagName) && !skipped(root)) translateAttrs(root);
    return;
  }
  translateAttrs(root);
  // 선택지는 보이는 글자만 바꾸고, 저장되는 값은 한국어 그대로 둬요
  if (root.tagName === "OPTION" && !root.hasAttribute("value")) root.setAttribute("value", root.textContent);
  if (translateBlock(root)) return;
  for (const child of [...root.childNodes]) translateTree(child);
}

if (LANG !== "ko") {
  // 새로 그려지는 부분(검색 결과, 카드 등)도 바로 번역해요
  let busy = false;
  const observer = new MutationObserver(records => {
    if (busy) return;
    busy = true;
    for (const r of records) {
      if (r.type === "characterData") translateTree(r.target);
      else if (r.type === "attributes") { if (!skipped(r.target)) translateAttrs(r.target); }
      else r.addedNodes.forEach(translateTree);
    }
    observer.takeRecords();
    busy = false;
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  });

  // 알림 창(alert, confirm, prompt)도 번역
  const _alert = window.alert.bind(window), _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
  window.alert = m => _alert(tr(m));
  window.confirm = m => _confirm(tr(m));
  window.prompt = (m, d) => _prompt(tr(m), d);
}

// 맨 아래(푸터) 언어 선택: 한국어 | English | 日本語 | 中文
function setupLangSwitch() {
  if (document.querySelector(".lang-switch")) return;
  const nav = document.createElement("nav");
  nav.className = "lang-switch";
  nav.setAttribute("aria-label", "Language");
  nav.innerHTML = LANGS.map(l => l.code === LANG
    ? `<span aria-current="true">${l.label}</span>`
    : `<a href="#" data-lang="${l.code}" lang="${l.code}">${l.label}</a>`).join("");
  (document.querySelector("footer") || document.body).append(nav);
  nav.addEventListener("click", e => {
    const a = e.target.closest("[data-lang]");
    if (!a) return;
    e.preventDefault();
    try { localStorage.setItem(LANG_KEY, a.dataset.lang); } catch (err) {}
    const url = new URL(location.href);
    url.searchParams.delete("lang");
    location.href = url.toString();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLangSwitch();
  if (LANG === "ko") return;
  document.title = tr(document.title);
  translateTree(document.body);
});

