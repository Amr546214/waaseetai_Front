import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CreateRequest, resetCreateRequestPageLoadState } from '../../create-request';

const MOCK_CATEGORIES = [
  {
    id: 'c-dev',
    name: 'برمجة وتطوير',
    icon: 'code',
    totalProviders: 12,
    specialties: [
      { id: 's-fe', name: 'تطوير الواجهات الأمامية' },
      { id: 's-be', name: 'تطوير الخدمات الخلفية' },
      { id: 's-ios', name: 'تطوير تطبيقات iOS' },
    ],
  },
  {
    id: 'c-des',
    name: 'تصميم وإبداع',
    icon: 'palette',
    totalProviders: 8,
    specialties: [
      { id: 's-logo', name: 'تصميم الشعارات' },
      { id: 's-ui', name: 'تصميم واجهات المستخدم' },
    ],
  },
  {
    id: 'other',
    name: 'أخرى',
    icon: 'feather',
    totalProviders: 0,
    specialties: [],
  },
];

const META = {
  success: true,
  data: {
    categories: MOCK_CATEGORIES,
  },
};

describe('Step1Specialty - compact cards, fold/edit, and accessibility', () => {
  let fixture: ComponentFixture<CreateRequest>;
  let parent: CreateRequest;
  let step1El: HTMLElement;

  async function mountWizard(initialSpec: string | null = null) {
    sessionStorage.clear();
    resetCreateRequestPageLoadState();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });

    await TestBed.configureTestingModule({
      imports: [CreateRequest],
      providers: [
        provideRouter([]),
        {
          provide: HttpClient,
          useValue: {
            get: (url: string) => of(/\/meta$/.test(String(url)) ? META : { success: false }),
            post: () => of({ success: true, data: { hasRecommendation: false } }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRequest);
    parent = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    if (initialSpec) {
      parent.selectSpec(initialSpec);
      fixture.detectChanges();
    }

    step1El = fixture.nativeElement.querySelector('app-step1-specialty') as HTMLElement;
    return step1El;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('initially renders compact cards (around 64-80px tall) and search when no selection exists', async () => {
    await mountWizard();

    expect(parent.selectedSpec()).toBeNull();
    const search = step1El.querySelector('input[type="search"]');
    expect(search).toBeTruthy();

    const cards = step1El.querySelectorAll<HTMLButtonElement>('button.spec-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const firstCard = cards[0];
    expect(firstCard.tagName).toBe('BUTTON');
    expect(firstCard.type).toBe('button');
    expect(firstCard.className).toContain('min-h-[64px]');
    expect(firstCard.className).toContain('max-h-[80px]');

    // Summary card should not be displayed when nothing is selected
    expect(step1El.querySelector('[data-testid="selected-spec-summary"]')).toBeNull();
  });

  it('selecting a card folds main-selection into summary with Arabic Edit button and reveals sub-specialties', async () => {
    await mountWizard();

    const devCard = Array.from(step1El.querySelectorAll<HTMLButtonElement>('button.spec-card')).find((btn) =>
      btn.textContent?.includes('برمجة وتطوير')
    )!;
    expect(devCard).toBeTruthy();

    devCard.click();
    fixture.detectChanges();

    expect(parent.selectedSpec()).toBe('c-dev');

    // Summary is visible
    const summary = step1El.querySelector('[data-testid="selected-spec-summary"]');
    expect(summary).toBeTruthy();
    expect(summary?.textContent).toContain('برمجة وتطوير');

    // Arabic Edit button is present
    const editBtn = step1El.querySelector<HTMLButtonElement>('#edit-spec-btn')!;
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent).toContain('تعديل');
    expect(editBtn.getAttribute('aria-expanded')).toBe('false');
    expect(editBtn.getAttribute('aria-controls')).toBe('f-specialty-picker');

    // Sub-specialties are revealed directly below
    const subChips = step1El.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    expect(subChips.length).toBe(3);
    expect(subChips[0].textContent).toContain('تطوير الواجهات الأمامية');

    // Counter is visible
    const counter = step1El.querySelector('#subs-count');
    expect(counter?.textContent?.trim()).toBe('0 / 5');
  });

  it('clicking Edit reopens compact cards and search, preserving existing selection until actual change', async () => {
    await mountWizard('c-dev');

    parent.toggleSub('تطوير الواجهات الأمامية');
    fixture.detectChanges();
    expect(parent.selectedSubs().size).toBe(1);

    const editBtn = step1El.querySelector<HTMLButtonElement>('#edit-spec-btn')!;
    editBtn.click();
    fixture.detectChanges();

    // Reopened picker
    const search = step1El.querySelector('input[type="search"]');
    expect(search).toBeTruthy();

    const cards = step1El.querySelectorAll<HTMLButtonElement>('button.spec-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Previously selected card has visible selected state
    const devCard = Array.from(cards).find((btn) => btn.textContent?.includes('برمجة وتطوير'))!;
    expect(devCard.getAttribute('aria-pressed')).toBe('true');
    expect(devCard.className).toContain('border-2');

    // Existing selection is preserved
    expect(parent.selectedSpec()).toBe('c-dev');
    expect(parent.selectedSubs().has('تطوير الواجهات الأمامية')).toBe(true);
  });

  it('selecting the same category while editing folds back and preserves sub-specialties', async () => {
    await mountWizard('c-dev');
    parent.toggleSub('تطوير الواجهات الأمامية');
    fixture.detectChanges();

    // Open edit mode
    step1El.querySelector<HTMLButtonElement>('#edit-spec-btn')!.click();
    fixture.detectChanges();

    // Click the SAME category card
    const devCard = Array.from(step1El.querySelectorAll<HTMLButtonElement>('button.spec-card')).find((btn) =>
      btn.textContent?.includes('برمجة وتطوير')
    )!;
    devCard.click();
    fixture.detectChanges();

    // Folds back into summary
    expect(step1El.querySelector('[data-testid="selected-spec-summary"]')).toBeTruthy();

    // Sub-specialties preserved
    expect(parent.selectedSpec()).toBe('c-dev');
    expect(parent.selectedSubs().has('تطوير الواجهات الأمامية')).toBe(true);
    expect(parent.selectedSubs().size).toBe(1);
  });

  it('selecting a different category updates selection, resets sub-specialties, and reveals new subs', async () => {
    await mountWizard('c-dev');
    parent.toggleSub('تطوير الواجهات الأمامية');
    fixture.detectChanges();

    // Open edit mode
    step1El.querySelector<HTMLButtonElement>('#edit-spec-btn')!.click();
    fixture.detectChanges();

    // Click DIFFERENT category
    const desCard = Array.from(step1El.querySelectorAll<HTMLButtonElement>('button.spec-card')).find((btn) =>
      btn.textContent?.includes('تصميم وإبداع')
    )!;
    desCard.click();
    fixture.detectChanges();

    // Folded into design summary
    expect(parent.selectedSpec()).toBe('c-des');
    expect(step1El.querySelector('[data-testid="selected-spec-name"]')?.textContent).toContain('تصميم وإبداع');

    // Old sub-specialties cleared
    expect(parent.selectedSubs().size).toBe(0);

    // New sub-specialties for design revealed
    const subChips = step1El.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    expect(subChips.length).toBe(2);
    expect(subChips[0].textContent).toContain('تصميم الشعارات');
  });

  it('stable validation target #f-specialty-grid is present both when folded and unfolded', async () => {
    await mountWizard();

    // Unfolded
    const gridUnfolded = step1El.querySelector('#f-specialty-grid');
    expect(gridUnfolded).toBeTruthy();
    expect(gridUnfolded?.getAttribute('data-field-wrap')).not.toBeNull();

    // Fold
    parent.selectSpec('c-dev');
    fixture.detectChanges();

    // Folded
    const gridFolded = step1El.querySelector('#f-specialty-grid');
    expect(gridFolded).toBeTruthy();
    expect(gridFolded).toBe(gridUnfolded); // Exact same stable element
  });

  it('stops propagation of Enter key on selection/edit controls so parent wizard does not advance', async () => {
    await mountWizard();

    const searchInput = step1El.querySelector('input[type="search"]')!;
    const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(enterEvt, 'stopPropagation');

    searchInput.dispatchEvent(enterEvt);
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(parent.currentStep()).toBe(1);

    const firstCard = step1El.querySelector<HTMLButtonElement>('button.spec-card')!;
    const cardEnterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const cardStopSpy = vi.spyOn(cardEnterEvt, 'stopPropagation');

    firstCard.dispatchEvent(cardEnterEvt);
    expect(cardStopSpy).toHaveBeenCalled();
    expect(parent.currentStep()).toBe(1);
  });

  it('handles "other" custom input when other category is selected', async () => {
    await mountWizard();

    parent.selectSpec('other');
    fixture.detectChanges();

    // Folded summary shows 'أخرى'
    expect(step1El.querySelector('[data-testid="selected-spec-name"]')?.textContent).toContain('أخرى');

    // Input for other is revealed
    const otherInput = step1El.querySelector<HTMLInputElement>('#f-other-spec');
    expect(otherInput).toBeTruthy();

    otherInput!.value = 'استشارات مالية';
    otherInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(parent.otherText()).toBe('استشارات مالية');
  });

  it('lets the native Enter click toggle a sub-specialty exactly once', async () => {
    await mountWizard('c-dev');
    const chip = step1El.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    chip.dispatchEvent(enter);
    fixture.detectChanges();
    expect(enter.defaultPrevented).toBe(false);
    // Browsers synthesize a click for Enter on a native button; jsdom needs it explicitly.
    chip.click();
    fixture.detectChanges();
    expect(parent.selectedSubs().has('تطوير الواجهات الأمامية')).toBe(true);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(parent.currentStep()).toBe(1);
  });

  it('restores draft selection into folded summary state on mount', async () => {
    await mountWizard('c-dev');

    // Mounted with selection -> starts folded
    expect(step1El.querySelector('[data-testid="selected-spec-summary"]')).toBeTruthy();
    expect(step1El.querySelector('input[type="search"]')).toBeNull();
  });
});
