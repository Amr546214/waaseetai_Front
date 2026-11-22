import { TourDefinition } from '../tour.types';
import { PAGE_TOURS } from './page-tours';
import { VISITOR_TOUR } from './visitor.tour';
import { ROLE_TOURS } from './role-tours';
import { CLIENT_PROFILE_EDIT_TOUR } from './client-profile-edit.tour';

/** guides started by a button INSIDE a page (not by the launcher chip): they get audio like every other tour */
export const FEATURE_TOURS: TourDefinition[] = [CLIENT_PROFILE_EDIT_TOUR];

/** Every tour of the app. The audio generator reads this list, so a tour added here gets its voice files on the next run of `npm run tour:audio`. */
export const ALL_TOURS: TourDefinition[] = [VISITOR_TOUR, ...PAGE_TOURS.map(e => e.tour), ...Object.values(ROLE_TOURS).filter((t): t is TourDefinition => !!t), ...FEATURE_TOURS];
