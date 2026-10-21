@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo VIVEDIVE 를 http://localhost:5500 으로 여는 중이에요. 이 창을 닫으면 사이트도 꺼져요.
start "" http://localhost:5500/index.html
python -m http.server 5500
