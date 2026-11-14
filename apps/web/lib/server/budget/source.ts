import type { Plaid } from 'plaid';
import type { AccountType } from '@/lib/budget/model';
import type { BankItemDoc } from './db';
import { plaid, plaidErrorCode } from './plaid';
import { decryptToken } from './tokenCrypto';

export type SourceAccount = {
    externalId: string;
    name: string;
    mask?: string;
    type: AccountType;
    balance?: number;
    currency?: string;
};

export type SourceTransaction = {
    externalId: string;
    externalAccountId: string;
    date: string;
    amount: number;
    merchant: string;
    plaidCategory?: { primary: string; detailed: string };
    pending: boolean;
    replacesExternalId?: string;
};

type SourceChanges = {
    added: SourceTransaction[];
    modified: SourceTransaction[];
    removed: string[];
    accounts: SourceAccount[];
    cursor: string;
    updateStatus?: string;
};

interface BankSource {
    pull(item: BankItemDoc): Promise<SourceChanges>;
    accounts(item: BankItemDoc): Promise<SourceAccount[]>;
    remove(item: BankItemDoc): Promise<void>;
}

const SYNC_PAGE = 500;
const MAX_RESTARTS = 3;

function accountType(a: Plaid.AccountBase): AccountType {
    const subtype = String(a.subtype ?? '');
    if (a.type === 'credit') return 'credit';
    if (a.type === 'depository') {
        if (subtype === 'checking') return 'checking';
        if (subtype === 'savings' || subtype === 'money market' || subtype === 'cd') return 'savings';
    }
    return 'other';
}

function fromPlaidAccount(a: Plaid.AccountBase): SourceAccount {
    return {
        externalId: a.account_id,
        name: a.name || a.official_name || 'Account',
        mask: a.mask ?? undefined,
        type: accountType(a),
        balance: a.balances.current ?? a.balances.available ?? undefined,
        currency: a.balances.iso_currency_code ?? a.balances.unofficial_currency_code ?? undefined,
    };
}

function fromPlaidTransaction(t: Plaid.Transaction): SourceTransaction {
    const pfc = t.personal_finance_category;
    return {
        externalId: t.transaction_id,
        externalAccountId: t.account_id,
        date: (t.pending && t.authorized_date) || t.date,
        // Plaid uses positive for money out. `|| 0` avoids -0.
        amount: -t.amount || 0,
        merchant: t.merchant_name || t.name || t.original_description || 'Unknown',
        plaidCategory: pfc ? { primary: pfc.primary, detailed: pfc.detailed } : undefined,
        pending: t.pending,
        replacesExternalId: t.pending_transaction_id ?? undefined,
    };
}

const accessToken = (item: BankItemDoc) => decryptToken(item.accessToken, item.plaidItemId);

const plaidSource: BankSource = {
    async pull(item) {
        const access_token = accessToken(item);
        for (let attempt = 0; ; attempt++) {
            // Every page is gathered before anything is written, so a failed loop leaves nothing half applied.
            let cursor = item.cursor || undefined;
            const changes: SourceChanges = { added: [], modified: [], removed: [], accounts: [], cursor: '' };
            try {
                let hasMore = true;
                while (hasMore) {
                    const page = await plaid().transactions.sync({
                        access_token,
                        cursor,
                        count: SYNC_PAGE,
                        options: { personal_finance_category_version: 'v2' },
                    });
                    changes.added.push(...page.added.map(fromPlaidTransaction));
                    changes.modified.push(...page.modified.map(fromPlaidTransaction));
                    changes.removed.push(...page.removed.map((r) => r.transaction_id));
                    changes.accounts = page.accounts.map(fromPlaidAccount);
                    changes.updateStatus = page.transactions_update_status;
                    cursor = page.next_cursor;
                    hasMore = page.has_more;
                }
                changes.cursor = cursor ?? '';
                return changes;
            } catch (err) {
                if (plaidErrorCode(err) === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' && attempt < MAX_RESTARTS)
                    continue;
                throw err;
            }
        }
    },

    async accounts(item) {
        const res = await plaid().accounts.get({ access_token: accessToken(item) });
        return res.accounts.map(fromPlaidAccount);
    },

    async remove(item) {
        try {
            await plaid().item.remove({ access_token: accessToken(item) });
        } catch (err) {
            const code = plaidErrorCode(err);
            if (code !== 'ITEM_NOT_FOUND' && code !== 'INVALID_ACCESS_TOKEN') throw err;
        }
    },
};

export function sourceFor(item: BankItemDoc): BankSource {
    switch (item.source) {
        case 'plaid':
            return plaidSource;
    }
}
