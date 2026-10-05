import { createMemoryHistory, createRouter } from 'vue-router';
import { startGuard } from './guards.ts';
import { routes } from './routes.ts';

// Memory history: there is no address bar, and the page URL stays app://renderer/index.html (CSP and the protocol
// handler see one file).
export function createAppRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.beforeEach(startGuard);
  return router;
}
