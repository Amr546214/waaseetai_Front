import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsCenter } from './notifications-center';

describe('NotificationsCenter', () => {
  let component: NotificationsCenter;
  let fixture: ComponentFixture<NotificationsCenter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsCenter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsCenter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
