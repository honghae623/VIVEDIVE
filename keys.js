/* =========================================================
   네이버 · 카카오 개발자센터 키를 여기에 넣어요
   (비워 두면 '시연 모드'로 동작해요)

   ■ 네이버  https://developers.naver.com → Application → 애플리케이션 등록
     - 사용 API: 네이버 로그인 (이름·별명 정도만 체크)
     - 환경: PC 웹
       서비스 URL      : http://localhost:5500
       Callback URL    : http://localhost:5500/callback.html
     - 발급된 Client ID 를 NAVER_CLIENT_ID 에 붙여 넣기
       (Client Secret 은 넣지 마세요. 이 사이트에는 필요 없어요)

   ■ 카카오  https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가
     - 앱 키 → REST API 키 를 KAKAO_REST_KEY 에 붙여 넣기
     - 플랫폼 → Web → 사이트 도메인: http://localhost:5500
     - 카카오 로그인 → 활성화 ON
       Redirect URI : http://localhost:5500/callback.html
     - 카카오 로그인 → 동의항목 → 닉네임 '필수 동의'
     - 보안 → Client Secret 은 '사용 안 함' 그대로 두기

   ※ 인터넷에 올린 주소(예: https://vivedive.netlify.app)로 쓰려면
     위의 localhost:5500 자리에 그 주소도 똑같이 추가 등록해 주세요.
   ========================================================= */

const NAVER_CLIENT_ID = "5zO4JGT8DCUI4Gr1ZyXa";
const KAKAO_REST_KEY = "";
