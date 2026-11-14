export type BankConnection = {
    id: string;
    status: 'ok' | 'error';
    errors: string[];
    lastSyncedAt?: string;
};

export type BudgetAccount = {
    id: string;
    connectionId?: string;
    institution?: string;
    name: string;
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
    categoryId?: string;
    pending: boolean;
};

export type SyncResult = {
    connections: { connectionId: string; added: number; errors: string[]; skipped: boolean }[];
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
    categoryIds: string[];
    order: number;
};

export type BudgetInput = Pick<Budget, 'name' | 'icon' | 'color' | 'period' | 'amount' | 'categoryIds'>;

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
    /** When bank alerts were last checked. */
    dataAsOf?: string;
};

export type CategoryKind = 'spending' | 'income' | 'ignore';
export const CATEGORY_KINDS: CategoryKind[] = ['spending', 'income', 'ignore'];

export type Category = {
    id: string;
    name: string;
    icon: string;
    color: string;
    kind: CategoryKind;
    order: number;
};

export type CategoryInput = Pick<Category, 'name' | 'icon' | 'color' | 'kind'>;

export type Rule = { id: string; merchantContains: string; categoryId: string };

export type CategoriesResponse = { categories: Category[]; rules: Rule[] };

export type TransactionsResponse = { transactions: BudgetTransaction[]; hasMore: boolean };
