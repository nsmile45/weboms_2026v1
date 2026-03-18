# WEBOMS 2026 개발 계획

## 진행 상태 범례
- `[x]` 완료
- `[~]` 진행 중
- `[ ]` 예정

---

## 히스토리

### 2026-03-18
- [x] 초기 프로젝트 세팅 (Fastify + React + TypeScript + Oracle)
- [x] **인증 시스템 완성** (`backend/src/routes/auth/index.ts`)
  - 고객사 직접 로그인 (CUSTCD 테이블, taxNo + password)
  - 영업사원 로그인 (SALESM 테이블, taxNo + salesNo + password)
  - JWT 토큰 발급: taxNo, custNm, salesNo, salesNm, empNo, plocCd, rlocCd, jlocCd, domeYn, jgchgYn, sublseqDiv
  - GNCODE 조회 (ploc_cd, rloc_cd, jloc_cd)
  - MYINFO.SUBLSEQ_DIV 조회 (날짜별 순번 vs Oracle 시퀀스 분기)
  - `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- [x] **JWT 타입 정의** (`backend/src/types/index.ts`)
  - `JwtPayload` 인터페이스 + `@fastify/jwt` 모듈 확장
- [x] **Zustand 인증 스토어** (`frontend/src/store/auth.ts`)
  - `useAuthStore`: token, user, isAuthenticated, login(), logout()
  - `persist` 미들웨어로 localStorage 저장 (키: `weboms-auth`)
- [x] **P121 도서 주문 백엔드 완성** (`backend/src/routes/p1/p121.ts`)
  - `GET /codes` — GNCODE 코드 목록 (sublGb, meGb, besongGb, besongCd, chkGb)
  - `GET /custme` — 서점 검색 (CUSTCL + CUSTME 조인)
  - `GET /custme/:metaxNo/misu` — 미수금 조회 (F_IWMISU_PUB 함수)
  - `GET /books` — 도서 검색 (F_MERATE 함수로 할인율 적용)
  - `GET /orders` — 주문 목록 조회 (날짜/서점/구분 필터)
  - `GET /orders/:sublDate/:sublNo` — 주문 상세 (마스터 + 라인)
  - `POST /orders` — 신규 주문 생성 (CHULMT + BJUMUN 동시 INSERT, 트랜잭션)
  - `PUT /orders/:sublDate/:sublNo` — 마스터 수정
  - `DELETE /orders/:sublDate/:sublNo` — 전표 삭제 (물리 삭제)
  - `POST /orders/:sublDate/:sublNo/lines` — 도서 라인 추가
  - `PUT /orders/:sublDate/:sublNo/lines/:sublSeq` — 도서 라인 수정
  - `DELETE /orders/:sublDate/:sublNo/lines/:sublSeq` — 도서 라인 삭제 (마지막 라인 삭제 시 CHULMT도 삭제)
- [~] **P121 도서 주문 프론트엔드** (`frontend/src/pages/p1/P121Page.tsx`)
  - 주문 목록 / 마스터 폼 / 도서 라인 그리드 UI 개발 중

---

## 현재 구현된 라우트

| 경로 | 파일 | 상태 |
|------|------|------|
| `POST /api/auth/login` | `auth/index.ts` | [x] |
| `GET /api/auth/me` | `auth/index.ts` | [x] |
| `POST /api/auth/logout` | `auth/index.ts` | [x] |
| `GET /api/p0/bookcd/...` | `p0/bookcd.ts` | [x] |
| `GET /api/p1/p121/codes` | `p1/p121.ts` | [x] |
| `GET /api/p1/p121/custme` | `p1/p121.ts` | [x] |
| `GET /api/p1/p121/books` | `p1/p121.ts` | [x] |
| `CRUD /api/p1/p121/orders` | `p1/p121.ts` | [x] |

## 현재 구현된 페이지

| 페이지 | 파일 | 상태 |
|--------|------|------|
| 로그인 | `auth/LoginPage.tsx` | [x] |
| 대시보드 | `dashboard/DashboardPage.tsx` | [x] |
| 도서 마스터 | `p0/BookMasterPage.tsx` | [x] |
| P121 도서 주문 | `p1/P121Page.tsx` | [~] |

---

## 앞으로 할 일

- [ ] P121 프론트 완성 및 테스트
- [ ] 추가 메뉴/페이지 개발 (p2, p3 등)
- [ ] 환경별 배포 설정 (dev / prod)
