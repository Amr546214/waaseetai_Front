import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectMiniChat } from './project-mini-chat';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('ProjectMiniChat', () => {
  let component: ProjectMiniChat;
  let fixture: ComponentFixture<ProjectMiniChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectMiniChat],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMiniChat);
    component = fixture.componentInstance;
  });

  it('identifies negotiation messages correctly', () => {
    const negMsg1 = { content: '{"isNegotiation":true,"kind":"CLIENT_ACCEPT_COUNTER","price":2000}' } as any;
    const negMsg2 = { content: 'WS_NEGOTIATION::offer-1::{"negType":"counter_accept","price":2000}' } as any;
    const regularMsg = { content: 'hello let us start the project' } as any;

    expect(component.isNegotiationMsg(negMsg1)).toBe(true);
    expect(component.isNegotiationMsg(negMsg2)).toBe(true);
    expect(component.isNegotiationMsg(regularMsg)).toBe(false);
  });

  it('parses negotiation payload without exposing raw json', () => {
    const raw = 'WS_NEGOTIATION::offer-1::{"negType":"counter_accept","negTypeName":"قبول العرض المضاد","price":"2000","deliveryDays":10,"status":"ACCEPTED"}';
    const parsed = component.getNegData({ content: raw } as any);

    expect(parsed).toBeTruthy();
    expect(parsed.price).toBe('2000');
    expect(parsed.deliveryDays).toBe(10);
    expect(component.getNegTitle(parsed)).toBe('تم قبول العرض المضاد');
  });

  it('correctly distinguishes image attachments from other files', () => {
    expect(component.isImage('https://cdn.example.com/photo.jpg')).toBe(true);
    expect(component.isImage('https://cdn.example.com/screen.PNG')).toBe(true);
    expect(component.isImage(undefined, 'design.webp')).toBe(true);
    expect(component.isImage('https://cdn.example.com/archive.zip')).toBe(false);
    expect(component.isImage(undefined, 'document.pdf')).toBe(false);
  });
});

