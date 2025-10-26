import assert from 'node:assert';
import moment from 'moment';
import 'moment-timezone';
import { isPastSlotForDate } from '../controllers/consultation/index.js';
const TZ = 'Africa/Lagos';
function run() {
    // Fixed base date for deterministic tests
    const baseDate = moment.tz('2025-01-01', TZ);
    const now = moment(baseDate).hours(22).minutes(0).seconds(0);
    // Same day comparisons
    {
        const selectedDate = baseDate.clone();
        const slot21 = 21 * 60;
        const slot22_30 = 22 * 60 + 30;
        assert.strictEqual(isPastSlotForDate(selectedDate, slot21, now), true, '21:00 should be past when now is 22:00 on same day');
        assert.strictEqual(isPastSlotForDate(selectedDate, slot22_30, now), false, '22:30 should NOT be past when now is 22:00 on same day');
    }
    // Different day: slots should not be considered past
    {
        const selectedDateNext = baseDate.clone().add(1, 'day');
        const slot21 = 21 * 60;
        assert.strictEqual(isPastSlotForDate(selectedDateNext, slot21, now), false, 'Slots on a different day should not be considered past');
    }
    console.log('Time comparison tests passed');
}
run();
//# sourceMappingURL=timeComparison.test.js.map