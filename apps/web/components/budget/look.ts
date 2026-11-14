import { pickableIconNames, type ColorSwatch, type IconName } from '@bradydallama/ui';
import { HABIT_COLORS, habitPresets } from '@/lib/habits/model';

export const SWATCHES: ColorSwatch[] = habitPresets.map((c) => ({ value: c, ...HABIT_COLORS[c] }));

const FAVORITE_ICONS: IconName[] = [
    'coins',
    'dollars',
    'cart',
    'shop',
    'pricetag',
    'mug',
    'cake',
    'fish',
    'gift',
    'game',
    'ticket',
    'truck',
    'planet',
    'heart',
    'star',
    'gem',
    'paintbrush',
    'book',
    'cat',
    'leaf',
];

export const BUDGET_ICONS: IconName[] = [
    ...FAVORITE_ICONS,
    ...pickableIconNames.filter((n) => !FAVORITE_ICONS.includes(n)),
];
