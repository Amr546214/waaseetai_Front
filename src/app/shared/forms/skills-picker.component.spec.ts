import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SkillsPickerComponent } from './skills-picker.component';

@Component({ standalone: true, imports: [SkillsPickerComponent], template: `<ws-skills-picker [options]="options()" [selected]="selected()" (selectedChange)="selected.set($event)" />` })
class Host { options = signal(['Figma', 'Adobe Photoshop', 'تصميم الشعارات']); selected = signal<string[]>(['Figma']); }

describe('SkillsPickerComponent', () => {
  const make = () => { const f = TestBed.createComponent(Host); f.detectChanges(); return f; };
  const names = (f: any, sel: string) => [...(f.nativeElement as HTMLElement).querySelectorAll(sel)].map(e => e.getAttribute('data-skill'));

  it('lists only the options not yet selected; picking moves one to the chips; removing puts it back', () => {
    const f = make();
    expect(names(f, '[data-testid="skills-options"] [data-skill]')).toEqual(['Adobe Photoshop', 'تصميم الشعارات']);
    (f.nativeElement.querySelector('[data-skill="Adobe Photoshop"].skp-opt') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.selected()).toEqual(['Figma', 'Adobe Photoshop']);
    expect(names(f, '.skp-chip')).toEqual(['Figma', 'Adobe Photoshop']);
    (f.nativeElement.querySelector('.skp-chip[data-skill="Figma"] .skp-x') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.selected()).toEqual(['Adobe Photoshop']);
  });

  it('search filters the options; there is no free-text way to add something that is not an option', () => {
    const f = make();
    const input = f.nativeElement.querySelector('[data-testid="skills-search"]') as HTMLInputElement;
    input.value = 'شعار'; input.dispatchEvent(new Event('input')); f.detectChanges();
    expect(names(f, '[data-testid="skills-options"] [data-skill]')).toEqual(['تصميم الشعارات']);
    input.value = 'Python'; input.dispatchEvent(new Event('input')); f.detectChanges();
    expect(names(f, '[data-testid="skills-options"] [data-skill]')).toEqual([]);
    expect(f.nativeElement.querySelector('[data-testid="skills-none"]')).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); f.detectChanges();
    expect(f.componentInstance.selected()).toEqual(['Figma']); // Enter on an unknown word adds nothing
  });

  it('no options (no main specialty yet) shows the choose-the-field-first message and no input', () => {
    const f = make();
    f.componentInstance.options.set([]); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="skills-need-field"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="skills-search"]')).toBeNull();
  });

  it('stops at the maximum of 30 skills', () => {
    const f = make();
    const many = Array.from({ length: 31 }, (_, i) => `S${i}`);
    f.componentInstance.options.set(many);
    f.componentInstance.selected.set(many.slice(0, 30)); f.detectChanges();
    expect(f.nativeElement.querySelector('.skp-hint')!.textContent).toContain('30');
    (f.nativeElement.querySelector('[data-skill="S30"].skp-opt') as HTMLElement | null)?.click();
    expect(f.componentInstance.selected().length).toBe(30);
  });
});
