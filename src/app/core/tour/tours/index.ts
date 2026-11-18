import { TourDefinition } from '../tour.types';
import { PAGE_TOURS } from './page-tours';
import { VISITOR_TOUR } from './visitor.tour';

/** Every tour of the app. The audio generator reads this list, so a tour added here gets its voice files on the next run of `npm run tour:audio`. */
export const ALL_TOURS: TourDefinition[] = [VISITOR_TOUR, ...PAGE_TOURS.map(e => e.tour)];
