import { CLIENT_OVERVIEW_ROUTES } from './client.routes';

describe('CLIENT_OVERVIEW_ROUTES — مراجعة التسليم routing', () => {
  it('projects/review resolves to a real lazy-loaded component, not the old dead-end redirect to projects/active', () => {
    const route = CLIENT_OVERVIEW_ROUTES.find(r => r.path === 'projects/review');
    expect(route).toBeTruthy();
    expect(route?.redirectTo).toBeUndefined();
    expect(typeof route?.loadComponent).toBe('function');
    expect(route?.data?.['title']).toBe('مراجعة التسليم');
  });

  it('projects/:id/delivery-review/:stageId still exists and is lazy-loaded', () => {
    const route = CLIENT_OVERVIEW_ROUTES.find(r => r.path === 'projects/:id/delivery-review/:stageId');
    expect(route).toBeTruthy();
    expect(route?.redirectTo).toBeUndefined();
    expect(typeof route?.loadComponent).toBe('function');
  });

  it('projects/review is declared before the projects/:id catch-all so it is never shadowed by the :id param route', () => {
    const reviewIndex = CLIENT_OVERVIEW_ROUTES.findIndex(r => r.path === 'projects/review');
    const catchAllIndex = CLIENT_OVERVIEW_ROUTES.findIndex(r => r.path === 'projects/:id');
    expect(reviewIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThanOrEqual(0);
    expect(reviewIndex).toBeLessThan(catchAllIndex);
  });
});
