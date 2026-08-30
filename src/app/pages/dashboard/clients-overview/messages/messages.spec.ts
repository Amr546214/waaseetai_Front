import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientMessages } from './messages';

describe('Messages', () => {
  let component: ClientMessages;
  let fixture: ComponentFixture<ClientMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientMessages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
