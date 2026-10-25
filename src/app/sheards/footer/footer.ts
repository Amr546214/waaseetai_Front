import { Component } from '@angular/core';
import { BrandNamePipe } from '../../shared/brand/brand-name.pipe';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [BrandNamePipe, RouterLink],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css'],
})
export class Footer {

}
