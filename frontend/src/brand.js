// 고객사 브랜딩 설정. 고객사가 바뀌면 이 파일과 styles.css 맨 위의 브랜드 색 토큰만 바꾼다.
//
// 공식 로고 파일은 이 공개 저장소에 넣지 않는다.
// 고객사 승인을 받은 환경에서만 frontend/public/brand/ 에 파일을 두고 logoSrc 에 경로를 지정한다.
//   예) logoSrc: '/brand/logo.svg'
export const BRAND = {
  systemName: 'BNK 출입관리시스템',
  logoSrc: null,
  logoAlt: 'BNK',
  // 모든 화면 상단에 항상 표시되는 안내 (실제 서비스로 오인하지 않도록)
  draftNotice: '제안용 시안입니다. BNK 공식 서비스가 아니며, 실제 개인정보를 입력하지 마세요.',
}
