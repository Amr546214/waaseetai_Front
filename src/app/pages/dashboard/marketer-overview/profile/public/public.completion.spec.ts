import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Public } from './public';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';

describe('marketer public card: completion copy', () => {
  let fixture: ComponentFixture<Public>;
  const setup = async (pct: number) => {
    await TestBed.configureTestingModule({
      imports: [Public],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }) } },
        { provide: MarketerProfileService, useValue: { getProfile: () => of({ success: true, data: { completionPercentage: pct, marketingChannels: [], user: {}, id: 'p1' } }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Public);
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('says only what is true (the percentage) and links to finish the profile; the unproven "معدل تحويل أعلى من المتوسط · لا بلاغات" is gone', async () => {
    await setup(70);
    const t = fixture.nativeElement.textContent as string;
    expect(t).not.toContain('معدل تحويل أعلى من المتوسط');
    expect(t).not.toContain('لا بلاغات');
    const copy = fixture.nativeElement.querySelector('[data-testid="public-completion-copy"]') as HTMLElement;
    expect(copy.textContent).toContain('الملف مكتمل 70%');
    expect(copy.querySelector('a')!.getAttribute('href')).toBe('/marketer-overview/profile/data');
  });

  it('at 100% there is no "أكمل ملفك" link', async () => {
    await setup(100);
    const copy = fixture.nativeElement.querySelector('[data-testid="public-completion-copy"]') as HTMLElement;
    expect(copy.textContent).toContain('الملف مكتمل 100%');
    expect(copy.querySelector('a')).toBeNull();
  });
});
