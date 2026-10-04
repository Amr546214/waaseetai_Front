import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AddAccountBase } from '../../../../../shared/add-account/add-account.base';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';

@Component({
	selector: 'app-add-account',
	standalone: true,
	imports: [CommonModule, FormsModule, ReactiveFormsModule, BioFieldDirective, FieldErrorComponent, FormSummaryComponent],
	templateUrl: './add-account.html',
	styles: [`
    @keyframes ws-fade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes skel-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .wz-panel {
      display: none;
      animation: ws-fade 0.2s ease forwards;
    }
    .wz-panel.show {
      display: block;
    }
    .role-disabled {
      cursor: default;
    }
    .state-card {
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      backdrop-filter: blur(12px);
      border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .role-card {
      position: relative;
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.02)));
      border: 1.5px solid var(--sec-bd, rgba(255,255,255,.10));
      border-radius: 16px;
      padding: 22px 16px 18px;
      cursor: pointer;
      transition: border-color .2s, background .2s, transform .15s;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .role-card:not(.role-disabled):hover {
      border-color: rgba(43, 212, 199, 0.40);
      background: linear-gradient(135deg, rgba(43, 212, 199, 0.07), rgba(43, 127, 255, 0.04));
      transform: translateY(-2px);
    }
    :host-context(body.light-theme) .role-card,
    :host-context(body.theme-light) .role-card,
    :host-context(.light-theme) .role-card,
    :host-context(.theme-light) .role-card {
      background: #fff;
      border-color: #E7EAF1;
    }
    :host-context(body.light-theme) .role-card:not(.role-disabled):hover,
    :host-context(body.theme-light) .role-card:not(.role-disabled):hover,
    :host-context(.light-theme) .role-card:not(.role-disabled):hover,
    :host-context(.theme-light) .role-card:not(.role-disabled):hover {
      background: #f0fbfa;
      border-color: rgba(43, 212, 199, 0.5);
    }
    .role-cta {
      width: 100%;
      padding: 10px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 9px;
      font-size: 13px;
      font-weight: 800;
      color: var(--txt, #fff);
      cursor: pointer;
      font-family: inherit;
      transition: all .18s;
      margin-top: auto;
    }
    .role-card:not(.role-disabled):hover .role-cta {
      background: linear-gradient(135deg, #2BD4C7, #2B7FFF);
      color: #070D24;
      border-color: transparent;
    }
    :host-context(body.light-theme) .role-cta,
    :host-context(body.theme-light) .role-cta,
    :host-context(.light-theme) .role-cta,
    :host-context(.theme-light) .role-cta {
      background: #f1f5f9;
      border-color: #E7EAF1;
      color: #0F172A;
    }
    .form-card {
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      backdrop-filter: blur(12px);
      border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
      border-radius: 16px;
      padding: 22px;
      margin-bottom: 14px;
    }
    :host-context(body.light-theme) .form-card,
    :host-context(body.theme-light) .form-card,
    :host-context(.light-theme) .form-card,
    :host-context(.theme-light) .form-card {
      background: #fff;
      border-color: #E7EAF1;
    }
    .inp-field {
      background: var(--inp-bg, rgba(255,255,255,.05));
      border: 1px solid var(--sec-bd, rgba(255,255,255,.10));
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      color: var(--txt, #fff);
      font-family: inherit;
      width: 100%;
      transition: border-color .15s;
    }
    .inp-field:focus {
      outline: none;
      border-color: rgba(43,212,199,.40);
    }
    :host-context(body.light-theme) .inp-field,
    :host-context(body.theme-light) .inp-field,
    :host-context(.light-theme) .inp-field,
    :host-context(.theme-light) .inp-field {
      background: #f8fafc;
      border-color: #D8DFEC;
      color: #0F172A;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddAccount extends AddAccountBase {}
