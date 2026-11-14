export type ParsedAlert = {
    amount: number;
    merchant: string;
    date?: string;
    account?: { name: string; last4?: string };
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const money = (s: string) => Number(s.replace(/,/g, ''));

const cleanMerchant = (s: string) =>
    s
        .replace(/\s+/g, ' ')
        .replace(/[.,]+$/, '')
        .trim();

// Assumed wording, oldest formats last; a sample email may call for adjustments. `spent` sets the sign.
const PATTERNS: { re: RegExp; spent: boolean }[] = [
    { re: /Your \$([\d,]+\.\d{2}) transaction with ([^\n]+)/i, spent: true },
    {
        re: /You made an? \$([\d,]+\.\d{2}) (?:debit card |card )?(?:transaction|purchase) (?:with|at) ([^\n]+)/i,
        spent: true,
    },
    {
        re: /(?:transaction|purchase) of \$([\d,]+\.\d{2}) (?:with|at) ([^\n]+?)(?: on [A-Z][a-z]{2} \d| has been|\.\s|\n|$)/i,
        spent: true,
    },
    { re: /charge of \(\$USD\) ([\d,]+\.\d{2}) at ([^\n]+?) has been authorized/i, spent: true },
    {
        re: /refund of \$([\d,]+\.\d{2}) (?:from|at|with) ([^\n]+?)(?: on [A-Z][a-z]{2} \d| has been|\.\s|\n|$)/i,
        spent: false,
    },
];

function field(text: string, label: string): string | undefined {
    return new RegExp(`${label}:?[ \\t]*\\n?[ \\t]*([^\\n]+)`, 'i').exec(text)?.[1]?.trim();
}

function parseDate(text: string): string | undefined {
    const m = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}), (\d{4})/i.exec(text);
    if (!m) return undefined;
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function parseAccount(text: string): ParsedAlert['account'] {
    const named = /Account:?\s*\n?\s*([^\n(]+?)\s*\(\.\.\.(\d{4})\)/i.exec(text);
    if (named) return { name: named[1].trim(), last4: named[2] };
    const last4 = /(?:\(\.\.\.|ending in |\.\.\.)(\d{4})/i.exec(text)?.[1];
    return last4 ? { name: 'Chase', last4 } : undefined;
}

/** Returns null for Chase emails that aren't purchase or refund alerts. */
export function parseChaseAlert(subject: string, body: string): ParsedAlert | null {
    const text = `${subject}\n${body}`;
    for (const { re, spent } of PATTERNS) {
        const m = re.exec(text);
        if (!m) continue;
        const merchant = cleanMerchant(m[2]);
        if (!merchant) continue;
        return {
            amount: spent ? -money(m[1]) : money(m[1]),
            merchant,
            date: parseDate(field(text, 'Date') ?? text),
            account: parseAccount(text),
        };
    }
    const merchant = field(text, 'Merchant');
    const amount = field(text, 'Amount')?.match(/\$([\d,]+\.\d{2})/)?.[1];
    if (merchant && amount)
        return {
            amount: -money(amount),
            merchant: cleanMerchant(merchant),
            date: parseDate(text),
            account: parseAccount(text),
        };
    return null;
}
