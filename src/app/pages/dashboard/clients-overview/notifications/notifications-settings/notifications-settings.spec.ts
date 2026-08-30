import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsSettings } from './notifications-settings';

describe('NotificationsSettings', () => {
  let component: NotificationsSettings;
  let fixture: ComponentFixture<NotificationsSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsSettings]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
