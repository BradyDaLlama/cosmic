export type PlaidCategoryGroup = {
    primary: string;
    label: string;
    detailed: { code: string; label: string }[];
};

export const PLAID_CATEGORIES: PlaidCategoryGroup[] = [
    {
        primary: 'BANK_FEES',
        label: 'Bank fees',
        detailed: [
            { code: 'BANK_FEES_ATM_FEES', label: 'ATM fees' },
            { code: 'BANK_FEES_INSUFFICIENT_FUNDS', label: 'Insufficient funds' },
            { code: 'BANK_FEES_INTEREST_CHARGE', label: 'Interest charge' },
            { code: 'BANK_FEES_FOREIGN_TRANSACTION_FEES', label: 'Foreign transaction fees' },
            { code: 'BANK_FEES_OVERDRAFT_FEES', label: 'Overdraft fees' },
            { code: 'BANK_FEES_LATE_FEES', label: 'Late fees' },
            { code: 'BANK_FEES_CASH_ADVANCE', label: 'Cash advance' },
            { code: 'BANK_FEES_OTHER_BANK_FEES', label: 'Other bank fees' },
        ],
    },
    {
        primary: 'ENTERTAINMENT',
        label: 'Entertainment',
        detailed: [
            { code: 'ENTERTAINMENT_CASINOS_AND_GAMBLING', label: 'Casinos and gambling' },
            { code: 'ENTERTAINMENT_MUSIC_AND_AUDIO', label: 'Music and audio' },
            {
                code: 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS',
                label: 'Sporting events amusement parks and museums',
            },
            { code: 'ENTERTAINMENT_TV_AND_MOVIES', label: 'TV and movies' },
            { code: 'ENTERTAINMENT_VIDEO_GAMES', label: 'Video games' },
            { code: 'ENTERTAINMENT_OTHER_ENTERTAINMENT', label: 'Other entertainment' },
        ],
    },
    {
        primary: 'FOOD_AND_DRINK',
        label: 'Food and drink',
        detailed: [
            { code: 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR', label: 'Beer wine and liquor' },
            { code: 'FOOD_AND_DRINK_COFFEE', label: 'Coffee' },
            { code: 'FOOD_AND_DRINK_FAST_FOOD', label: 'Fast food' },
            { code: 'FOOD_AND_DRINK_GROCERIES', label: 'Groceries' },
            { code: 'FOOD_AND_DRINK_RESTAURANT', label: 'Restaurant' },
            { code: 'FOOD_AND_DRINK_VENDING_MACHINES', label: 'Vending machines' },
            { code: 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK', label: 'Other food and drink' },
        ],
    },
    {
        primary: 'GENERAL_MERCHANDISE',
        label: 'General merchandise',
        detailed: [
            { code: 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS', label: 'Bookstores and newsstands' },
            { code: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES', label: 'Clothing and accessories' },
            { code: 'GENERAL_MERCHANDISE_CONVENIENCE_STORES', label: 'Convenience stores' },
            { code: 'GENERAL_MERCHANDISE_DEPARTMENT_STORES', label: 'Department stores' },
            { code: 'GENERAL_MERCHANDISE_DISCOUNT_STORES', label: 'Discount stores' },
            { code: 'GENERAL_MERCHANDISE_ELECTRONICS', label: 'Electronics' },
            { code: 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES', label: 'Gifts and novelties' },
            { code: 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES', label: 'Office supplies' },
            { code: 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES', label: 'Online marketplaces' },
            { code: 'GENERAL_MERCHANDISE_PET_SUPPLIES', label: 'Pet supplies' },
            { code: 'GENERAL_MERCHANDISE_SPORTING_GOODS', label: 'Sporting goods' },
            { code: 'GENERAL_MERCHANDISE_SUPERSTORES', label: 'Superstores' },
            { code: 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE', label: 'Tobacco and vape' },
            { code: 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE', label: 'Other general merchandise' },
        ],
    },
    {
        primary: 'HOME_IMPROVEMENT',
        label: 'Home improvement',
        detailed: [
            { code: 'HOME_IMPROVEMENT_FURNITURE', label: 'Furniture' },
            { code: 'HOME_IMPROVEMENT_HARDWARE', label: 'Hardware' },
            { code: 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE', label: 'Repair and maintenance' },
            { code: 'HOME_IMPROVEMENT_SECURITY', label: 'Security' },
            { code: 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT', label: 'Other home improvement' },
        ],
    },
    {
        primary: 'MEDICAL',
        label: 'Medical',
        detailed: [
            { code: 'MEDICAL_DENTAL_CARE', label: 'Dental care' },
            { code: 'MEDICAL_EYE_CARE', label: 'Eye care' },
            { code: 'MEDICAL_NURSING_CARE', label: 'Nursing care' },
            { code: 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS', label: 'Pharmacies and supplements' },
            { code: 'MEDICAL_PRIMARY_CARE', label: 'Primary care' },
            { code: 'MEDICAL_VETERINARY_SERVICES', label: 'Veterinary services' },
            { code: 'MEDICAL_OTHER_MEDICAL', label: 'Other medical' },
        ],
    },
    {
        primary: 'PERSONAL_CARE',
        label: 'Personal care',
        detailed: [
            { code: 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS', label: 'Gyms and fitness centers' },
            { code: 'PERSONAL_CARE_HAIR_AND_BEAUTY', label: 'Hair and beauty' },
            { code: 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING', label: 'Laundry and dry cleaning' },
            { code: 'PERSONAL_CARE_OTHER_PERSONAL_CARE', label: 'Other personal care' },
        ],
    },
    {
        primary: 'GENERAL_SERVICES',
        label: 'General services',
        detailed: [
            { code: 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING', label: 'Accounting and financial planning' },
            { code: 'GENERAL_SERVICES_AUTOMOTIVE', label: 'Automotive' },
            { code: 'GENERAL_SERVICES_CHILDCARE', label: 'Childcare' },
            { code: 'GENERAL_SERVICES_CONSULTING_AND_LEGAL', label: 'Consulting and legal' },
            { code: 'GENERAL_SERVICES_EDUCATION', label: 'Education' },
            { code: 'GENERAL_SERVICES_INSURANCE', label: 'Insurance' },
            { code: 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING', label: 'Postage and shipping' },
            { code: 'GENERAL_SERVICES_STORAGE', label: 'Storage' },
            { code: 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES', label: 'Other general services' },
        ],
    },
    {
        primary: 'GOVERNMENT_AND_NON_PROFIT',
        label: 'Government and non profit',
        detailed: [
            { code: 'GOVERNMENT_AND_NON_PROFIT_DONATIONS', label: 'Donations' },
            {
                code: 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES',
                label: 'Government departments and agencies',
            },
            { code: 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT', label: 'Tax payment' },
            {
                code: 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT',
                label: 'Other government and non profit',
            },
        ],
    },
    {
        primary: 'TRANSPORTATION',
        label: 'Transportation',
        detailed: [
            { code: 'TRANSPORTATION_BIKES_AND_SCOOTERS', label: 'Bikes and scooters' },
            { code: 'TRANSPORTATION_GAS', label: 'Gas' },
            { code: 'TRANSPORTATION_PARKING', label: 'Parking' },
            { code: 'TRANSPORTATION_PUBLIC_TRANSIT', label: 'Public transit' },
            { code: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES', label: 'Taxis and ride shares' },
            { code: 'TRANSPORTATION_TOLLS', label: 'Tolls' },
            { code: 'TRANSPORTATION_OTHER_TRANSPORTATION', label: 'Other transportation' },
        ],
    },
    {
        primary: 'TRAVEL',
        label: 'Travel',
        detailed: [
            { code: 'TRAVEL_FLIGHTS', label: 'Flights' },
            { code: 'TRAVEL_LODGING', label: 'Lodging' },
            { code: 'TRAVEL_RENTAL_CARS', label: 'Rental cars' },
            { code: 'TRAVEL_OTHER_TRAVEL', label: 'Other travel' },
        ],
    },
    {
        primary: 'RENT_AND_UTILITIES',
        label: 'Rent and utilities',
        detailed: [
            { code: 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', label: 'Gas and electricity' },
            { code: 'RENT_AND_UTILITIES_INTERNET_AND_CABLE', label: 'Internet and cable' },
            { code: 'RENT_AND_UTILITIES_RENT', label: 'Rent' },
            { code: 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT', label: 'Sewage and waste management' },
            { code: 'RENT_AND_UTILITIES_TELEPHONE', label: 'Telephone' },
            { code: 'RENT_AND_UTILITIES_WATER', label: 'Water' },
            { code: 'RENT_AND_UTILITIES_OTHER_UTILITIES', label: 'Other utilities' },
        ],
    },
    {
        primary: 'INCOME',
        label: 'Income',
        detailed: [
            { code: 'INCOME_CHILD_SUPPORT', label: 'Child support' },
            { code: 'INCOME_CONTRACTOR', label: 'Contractor' },
            { code: 'INCOME_DIVIDENDS', label: 'Dividends' },
            { code: 'INCOME_GIG_ECONOMY', label: 'Gig economy' },
            { code: 'INCOME_INTEREST_EARNED', label: 'Interest earned' },
            { code: 'INCOME_LONG_TERM_DISABILITY', label: 'Long term disability' },
            { code: 'INCOME_MILITARY', label: 'Military' },
            { code: 'INCOME_RENTAL', label: 'Rental' },
            { code: 'INCOME_RETIREMENT_PENSION', label: 'Retirement pension' },
            { code: 'INCOME_SALARY', label: 'Salary' },
            { code: 'INCOME_TAX_REFUND', label: 'Tax refund' },
            { code: 'INCOME_UNEMPLOYMENT', label: 'Unemployment' },
            { code: 'INCOME_OTHER', label: 'Other' },
        ],
    },
    {
        primary: 'TRANSFER_IN',
        label: 'Transfer in',
        detailed: [
            { code: 'TRANSFER_IN_ACCOUNT_TRANSFER', label: 'Account transfer' },
            { code: 'TRANSFER_IN_DEPOSIT', label: 'Deposit' },
            { code: 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS', label: 'Investment and retirement funds' },
            { code: 'TRANSFER_IN_SAVINGS', label: 'Savings' },
            { code: 'TRANSFER_IN_TRANSFER_IN_FROM_APPS', label: 'Transfer in from apps' },
            { code: 'TRANSFER_IN_WIRE', label: 'Wire' },
            { code: 'TRANSFER_IN_OTHER_TRANSFER_IN', label: 'Other transfer in' },
        ],
    },
    {
        primary: 'TRANSFER_OUT',
        label: 'Transfer out',
        detailed: [
            { code: 'TRANSFER_OUT_ACCOUNT_TRANSFER', label: 'Account transfer' },
            { code: 'TRANSFER_OUT_CRYPTO', label: 'Crypto' },
            { code: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS', label: 'Investment and retirement funds' },
            { code: 'TRANSFER_OUT_SAVINGS', label: 'Savings' },
            { code: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS', label: 'Transfer out from apps' },
            { code: 'TRANSFER_OUT_WIRE', label: 'Wire' },
            { code: 'TRANSFER_OUT_WITHDRAWAL', label: 'Withdrawal' },
            { code: 'TRANSFER_OUT_OTHER_TRANSFER_OUT', label: 'Other transfer out' },
        ],
    },
    {
        primary: 'LOAN_DISBURSEMENTS',
        label: 'Loan disbursements',
        detailed: [
            { code: 'LOAN_DISBURSEMENTS_AUTO', label: 'Auto' },
            { code: 'LOAN_DISBURSEMENTS_CASH_ADVANCES', label: 'Cash advances' },
            { code: 'LOAN_DISBURSEMENTS_EWA', label: 'Earned wage access' },
            { code: 'LOAN_DISBURSEMENTS_MORTGAGE', label: 'Mortgage' },
            { code: 'LOAN_DISBURSEMENTS_PERSONAL', label: 'Personal' },
            { code: 'LOAN_DISBURSEMENTS_STUDENT', label: 'Student' },
            { code: 'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT', label: 'Other disbursement' },
        ],
    },
    {
        primary: 'LOAN_PAYMENTS',
        label: 'Loan payments',
        detailed: [
            { code: 'LOAN_PAYMENTS_BNPL', label: 'Buy now pay later' },
            { code: 'LOAN_PAYMENTS_CAR_PAYMENT', label: 'Car payment' },
            { code: 'LOAN_PAYMENTS_CASH_ADVANCES', label: 'Cash advances' },
            { code: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', label: 'Credit card payment' },
            { code: 'LOAN_PAYMENTS_EWA', label: 'Earned wage access' },
            { code: 'LOAN_PAYMENTS_MORTGAGE_PAYMENT', label: 'Mortgage payment' },
            { code: 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT', label: 'Personal loan payment' },
            { code: 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT', label: 'Student loan payment' },
            { code: 'LOAN_PAYMENTS_OTHER_PAYMENT', label: 'Other payment' },
        ],
    },
    {
        primary: 'OTHER',
        label: 'Other',
        detailed: [{ code: 'OTHER_OTHER', label: 'Other' }],
    },
];

const labels = new Map<string, string>(
    PLAID_CATEGORIES.flatMap((g) => [
        [g.primary, g.label] as const,
        ...g.detailed.map((d) => [d.code, d.label] as const),
    ]),
);

export function plaidCategoryLabel(code: string): string {
    const known = labels.get(code);
    if (known) return known;
    const text = code.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}
