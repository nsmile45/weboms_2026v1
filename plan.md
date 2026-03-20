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

### 2026-03-20 — UI 디자인 전면 개편 

#### 1. 전체 테마 변경
- [x] NIBS(nicevan) 참고하여 전체 UI 사이즈/색상 통일
- [x] 루트 폰트 14px, 본문 텍스트 13px, 입력/버튼 h-8(32px) 통일
- [x] font-smoothing: `antialiased` → `auto` (서브픽셀 렌더링으로 선명도 개선)
- [x] 전체 배경색 `#eef2f7`(그레이) → `#ffffff`(흰색)으로 통일
- [x] body, AppLayout, 탭 바, 로그인 페이지 모두 흰색 배경

#### 2. 사이드바 (AppLayout)
- [x] 배경색: `#1e3a5f`(다크 네이비) → `#1C4D95`(블루)
- [x] 활성 메뉴 색상: `bg-blue-500` → `bg-orange-500` (오렌지)
- [x] 로고/아바타: `bg-blue-500` → `bg-orange-500`
- [x] 텍스트/아이콘: blue 계열 → white 투명도 기반으로 통일
- [x] 비활성 탭: `#c8d1dc` → `#f0f2f5`(연한 그레이)

#### 3. 도서마스터 (BookMasterPage)
- [x] 검색 영역 배경: `bg-white` → `bg-[#E7EBF5]`(블루그레이)
- [x] 그리드 헤더: `#34568B`(진한 네이비) → `#E7EBF5`(블루그레이) + 검은색 글자
- [x] 그리드 헤더 타이틀 중앙 정렬
- [x] 그리드 본문 세로선 추가 (`#d0d8e4`)
- [x] 그리드 선택 행: `#2b579a`(네이비) → `#FDF5E6`(OldLace) + 다크 텍스트
- [x] 텍스트 컬럼 색상 `text-slate-800` 통일 (숫자/상태 제외)
- [x] 컬럼 너비 확대 (도서명 150→250, 저자 65→100 등 총 ~1675px)
- [x] 총건수 + 엑셀 다운로드 바 추가 (xlsx + file-saver)
- [x] 그리드 헤더 클릭 시 정렬(sorting) 기능 추가 (▲▼ 표시)
- [x] 입력 필드 배경: `#fffde6`(노란색) → `#ffffff`(흰색)
- [x] 가로/세로/두께/무게 필드 비활성화(disabled) 처리

#### 4. 도서마스터 성능 최적화
- [x] `setDetail(null)` 제거 → 깜빡임 방지 (로딩 오버레이로 대체)
- [x] `ResizableGrid` → `React.memo` 적용
- [x] `DetailPanel` → `React.memo` 적용
- [x] `handleRowClick` → `useCallback` 적용

#### 5. 주문등록 (P121Page) — 도서마스터와 동일 스타일 적용
- [x] 그리드 헤더: `#E7EBF5` + 검은색 글자
- [x] 헤더 구분선: `#c8d0e0`
- [x] 본문 세로선 추가 (`#d0d8e4`)
- [x] 주문도서 합계 바: 흰색 배경 + 네이비 글자
- [x] 선택 행: OldLace(`#FDF5E6`)
- [x] 서점검색/전표조회 모달 그리드도 동일 적용

#### 6. 기타 페이지
- [x] DashboardPage: 통계 라벨 13px
- [x] LoginPage: 배경 흰색, 푸터 텍스트 13px

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
