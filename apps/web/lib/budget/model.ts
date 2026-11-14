export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'other';

export type BankItem = {
    id: string;
    source: 'plaid';
    institution: string;
    status: 'ok' | 'needs_reconnect';
    errorCode?: string;
    lastSyncedAt?: string;
};

export type BudgetAccount = {
    id: string;
    itemId?: string;
    name: string;
    mask?: string;
    type: AccountType;
    balance?: number;
    balanceAt?: string;
    currency?: string;
    hidden: boolean;
};

export type BudgetTransaction = {
    id: string;
    accountId: string;
    date: string;
    /** Negative = spent, positive = received. */
    amount: number;
    merchant: string;
    plaidCategory?: { primary: string; detailed: string };
    categoryId?: string;
    categorizedBy?: 'plaid' | 'rule' | 'you';
    note?: string;
    pending: boolean;
};

export type SyncResult = {
    items: {
        itemId: string;
        institution: string;
        added: number;
        modified: number;
        removed: number;
        updateStatus?: string;
        error?: string;
    }[];
};

export type BudgetPeriod = 'weekly' | 'monthly';
export const BUDGET_PERIODS: BudgetPeriod[] = ['weekly', 'monthly'];

export type Budget = {
    id: string;
    name: string;
    icon: string;
    color: string;
    period: BudgetPeriod;
    amount: number;
    plaidCategories: string[];
    categoryIds: string[];
    order: number;
};

export type BudgetInput = Pick<
    Budget,
    'name' | 'icon' | 'color' | 'period' | 'amount' | 'plaidCategories' | 'categoryIds'
>;

export type BudgetPeriodResult = { start: string; end: string; spent: number; unspent: number };

export type BudgetState = 'on_track' | 'ahead' | 'over';

export type BudgetStatus = Budget & {
    start: string;
    end: string;
    spent: number;
    previousSpent: number;
    history: BudgetPeriodResult[];
    unspentTotal: number;
    elapsed: number;
    state: BudgetState;
    transactions: BudgetTransaction[];
};

export type BudgetsResponse = {
    budgets: BudgetStatus[];
    usage: Record<string, number>;
};

export type CategoryKind = 'spending' | 'income' | 'ignore';
export const CATEGORY_KINDS: CategoryKind[] = ['spending', 'income', 'ignore'];

export type Category = {
    id: string;
    name: string;
    icon: string;
    color: string;
    kind: CategoryKind;
    plaidMatches: string[];
    order: number;
};

export type CategoryInput = Pick<Category, 'name' | 'icon' | 'color' | 'kind' | 'plaidMatches'>;

export type Rule = { id: string; merchantContains: string; categoryId: string };

export type CategoriesResponse = { categories: Category[]; rules: Rule[] };

export type TransactionsResponse = { transactions: BudgetTransaction[]; hasMore: boolean };
