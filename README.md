# 공모주 청약 캘린더 (실사용 구조)

KOSPI/KOSDAQ 공모주의 청약일/상장일을 캘린더로 보여주는 로컬 웹앱입니다.

## 아키텍처
- `app/fetcher.py`: 38커뮤니케이션 원천 데이터 수집/파싱
- `app/db.py`: SQLite 저장/조회 (`data/ipo.db`)
- `app/service.py`: 부트스트랩/갱신 오케스트레이션
- `server.py`: 정적 파일 + API 서버
- `src/app.js`: 캘린더 UI 및 상호작용

## 실행
```bash
cd /Users/sanghoonlee/Desktop/workspace/gongmoju
python3 server.py
```

브라우저:
```text
http://127.0.0.1:5173
```

## 주요 API
- `GET /api/health`: 서버 상태
- `GET /api/meta`: 데이터 갱신 시각, 소스
- `GET /api/events?market=ALL|KOSPI|KOSDAQ`: 일정 목록
- `POST /api/refresh`: 원천 소스 재수집 + JSON/DB 갱신

## 데이터 갱신
- UI의 `데이터 갱신` 버튼을 누르면 `POST /api/refresh`가 실행됩니다.
- 동일 기능을 CLI로 실행:
```bash
python3 scripts/fetch_ipo_data.py
```

## 실사용 운영 팁
- 먼저 `server.py`로만 실행하세요. (`python -m http.server` 사용 금지)
- 브라우저 캐시 이슈 방지를 위해 JS/CSS 버전 쿼리를 적용해 두었습니다.
- 데이터 소스 구조 변경 시 `app/fetcher.py`만 수정하면 됩니다.

## Render 배포
이 프로젝트는 `render.yaml` 기준으로 바로 배포할 수 있습니다.

1. GitHub에 저장소 푸시
2. Render에서 `New +` → `Blueprint` 선택
3. 저장소 연결 후 생성

설정 포인트:
- `startCommand`: `python3 server.py`
- `HOST=0.0.0.0`
- `IPO_DATA_DIR=/tmp/gongmoju-data` (free 플랜 호환)

배포 후 URL 예:
`https://<your-service>.onrender.com`

주의:
- Render free 플랜은 persistent disk를 지원하지 않습니다.
- 따라서 재시작/재배포 시 로컬 DB/JSON 캐시는 초기화될 수 있습니다.
- 앱은 시작 시 자동 부트스트랩(원천 재수집)하도록 구성되어 있습니다.
