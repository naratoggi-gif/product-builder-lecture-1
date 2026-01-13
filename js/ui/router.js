// SPA 라우터
export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  // 라우트 등록
  register(path, handler) {
    this.routes[path] = handler;
  }

  // 라우트 처리
  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const route = this.routes[hash];

    if (route) {
      this.currentRoute = hash;
      route();
    } else {
      // 404 - 기본 라우트로 이동
      this.navigate('dashboard');
    }
  }

  // 라우트 이동
  navigate(path) {
    window.location.hash = path;
  }

  // 현재 라우트 반환
  getCurrent() {
    return this.currentRoute;
  }

  // 초기 라우트 실행
  init() {
    this.handleRoute();
  }
}

export const router = new Router();
