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

// Batch 6 — the old standalone "مشاريع الموظفين" mock pages were retired
// (real employee assignment is now integrated into the canonical
// projects/active + projects/:id pages instead of a parallel project
// system). These two routes now redirect rather than disappear, so any
// existing bookmark/deep-link still lands somewhere real instead of 404ing.
describe('CLIENT_OVERVIEW_ROUTES — retired employee-projects routes redirect to the canonical pages', () => {
  it('projects/employee no longer loads the old dedicated mock component — it redirects', () => {
    const route = CLIENT_OVERVIEW_ROUTES.find(r => r.path === 'projects/employee');
    expect(route).toBeTruthy();
    expect(route?.loadComponent).toBeUndefined();
    expect(route?.redirectTo).toBe('projects/active');
  });

  it('projects/employee/:id no longer loads the old dedicated mock component — it redirects, preserving the real :id', () => {
    const route = CLIENT_OVERVIEW_ROUTES.find(r => r.path === 'projects/employee/:id');
    expect(route).toBeTruthy();
    expect(route?.loadComponent).toBeUndefined();
    expect(typeof route?.redirectTo).toBe('function');
    const redirectFn = route!.redirectTo as (data: any) => string;
    expect(redirectFn({ params: { id: 'CT-2291' } })).toBe('/client-overview/projects/CT-2291');
  });

  it('both retired routes are declared before the projects/:id catch-all', () => {
    const employeeListIndex = CLIENT_OVERVIEW_ROUTES.findIndex(r => r.path === 'projects/employee');
    const employeeDetailIndex = CLIENT_OVERVIEW_ROUTES.findIndex(r => r.path === 'projects/employee/:id');
    const catchAllIndex = CLIENT_OVERVIEW_ROUTES.findIndex(r => r.path === 'projects/:id');
    expect(employeeListIndex).toBeGreaterThanOrEqual(0);
    expect(employeeDetailIndex).toBeGreaterThanOrEqual(0);
    expect(employeeListIndex).toBeLessThan(catchAllIndex);
    expect(employeeDetailIndex).toBeLessThan(catchAllIndex);
  });
});
