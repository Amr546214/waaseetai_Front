import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RobotAvatar } from './robot-avatar';

describe('RobotAvatar', () => {
  let component: RobotAvatar;
  let fixture: ComponentFixture<RobotAvatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RobotAvatar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RobotAvatar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
