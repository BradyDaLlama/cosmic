import type { CategoriesResponse, Category, CategoryKind, Rule } from '@/lib/budget/model';
import { CATEGORY_KINDS } from '@/lib/budget/model';
import { invalid, isString, newId, notFound, oneOf, requiredText } from '../userRoute';
import { budgetDb, type CategoryDoc, type RuleDoc } from './db';
import { PLAID_CODE } from './plaid';
import { categorize } from './sync';

const toCategory = ({ _id, name, icon, color, kind, plaidMatches, order }: CategoryDoc): Category => ({
    id: _id,
    name,
    icon,
    color,
    kind,
    plaidMatches,
    order,
});
const toRule = (r: RuleDoc): Rule => ({ id: r._id, merchantContains: r.merchantContains, categoryId: r.categoryId });

type Fields = Pick<CategoryDoc, 'name' | 'icon' | 'color' | 'kind' | 'plaidMatches'>;

function fields(body: Record<string, unknown>, partial: boolean): Partial<Fields> {
    const out: Partial<Fields> = {};
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name', 60);
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if (!partial || 'kind' in body) out.kind = oneOf<CategoryKind>(body.kind, CATEGORY_KINDS, 'kind');
    if (!partial || 'plaidMatches' in body) {
        const m = body.plaidMatches ?? [];
        if (!Array.isArray(m) || m.length > 200 || !m.every((c) => isString(c, 80) && PLAID_CODE.test(c)))
            throw invalid('plaidMatches must be a list of Plaid category codes.');
        out.plaidMatches = [...new Set(m as string[])];
    }
    return out;
}

async function categorizeAll(email: string): Promise<void> {
    const ids = await (await budgetDb.transactions()).distinct('_id', { email, categorizedBy: { $ne: 'you' } });
    for (let i = 0; i < ids.length; i += 1000) await categorize(email, ids.slice(i, i + 1000));
}

export async function listCategories(email: string): Promise<CategoriesResponse> {
    const [cats, rules] = await Promise.all([budgetDb.categories(), budgetDb.rules()]);
    const [c, r] = await Promise.all([
        cats.find({ email }).sort({ order: 1 }).toArray(),
        rules.find({ email }).sort({ merchantContains: 1 }).toArray(),
    ]);
    return { categories: c.map(toCategory), rules: r.map(toRule) };
}

export async function createCategory(email: string, body: Record<string, unknown>): Promise<Category> {
    const col = await budgetDb.categories();
    const last = await col.find({ email }).sort({ order: -1 }).limit(1).next();
    const doc: CategoryDoc = {
        ...(fields(body, false) as Fields),
        _id: newId(),
        email,
        order: (last?.order ?? 0) + 1,
    };
    await col.insertOne(doc);
    await categorizeAll(email);
    return toCategory(doc);
}

export async function updateCategory(email: string, id: string, body: Record<string, unknown>): Promise<Category> {
    const set = fields(body, true);
    const doc = await (
        await budgetDb.categories()
    ).findOneAndUpdate({ _id: id, email }, { $set: set }, { returnDocument: 'after' });
    if (!doc) throw notFound();
    if ('plaidMatches' in set) await categorizeAll(email);
    return toCategory(doc);
}

export async function deleteCategory(email: string, id: string): Promise<void> {
    const [cats, rules, budgets, txs] = await Promise.all([
        budgetDb.categories(),
        budgetDb.rules(),
        budgetDb.budgets(),
        budgetDb.transactions(),
    ]);
    const { deletedCount } = await cats.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    await Promise.all([
        rules.deleteMany({ email, categoryId: id }),
        budgets.updateMany({ email, categoryIds: id }, { $pull: { categoryIds: id } }),
        txs.updateMany({ email, categoryId: id }, { $unset: { categoryId: '', categorizedBy: '' } }),
    ]);
    await categorizeAll(email);
}

export async function createRule(email: string, body: Record<string, unknown>): Promise<Rule> {
    const text = requiredText(body.merchantContains, 'merchantContains', 80);
    if (text.length < 2) throw invalid('merchantContains needs at least 2 characters.');
    if (!isString(body.categoryId, 64) || !body.categoryId) throw invalid('categoryId is required.');
    const category = await (await budgetDb.categories()).findOne({ _id: body.categoryId, email });
    if (!category) throw invalid('That category does not exist.');
    const rules = await budgetDb.rules();
    const existing = await rules.findOne({
        email,
        merchantContains: { $regex: `^${escapeRegex(text)}$`, $options: 'i' },
    });
    const doc: RuleDoc = existing
        ? { ...existing, categoryId: category._id }
        : { _id: newId(), email, merchantContains: text, categoryId: category._id, createdAt: new Date() };
    await rules.replaceOne({ _id: doc._id, email }, doc, { upsert: true });
    await categorizeAll(email);
    return toRule(doc);
}

export async function deleteRule(email: string, id: string): Promise<void> {
    const { deletedCount } = await (await budgetDb.rules()).deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    await categorizeAll(email);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const UNKNOWN_PLAID = ['OTHER', 'OTHER_OTHER', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE'];

export async function listInbox(email: string) {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const rows = await (
        await budgetDb.transactions()
    )
        .aggregate<{ _id: string; count: number; spent: number; last: string }>([
            {
                $match: {
                    email,
                    date: { $gte: since },
                    amount: { $lt: 0 },
                    categoryId: { $exists: false },
                    $or: [
                        { plaidCategory: { $exists: false } },
                        { 'plaidCategory.primary': { $in: UNKNOWN_PLAID } },
                        { 'plaidCategory.detailed': { $in: UNKNOWN_PLAID } },
                    ],
                },
            },
            { $group: { _id: '$merchant', count: { $sum: 1 }, spent: { $sum: '$amount' }, last: { $max: '$date' } } },
            { $sort: { last: -1 } },
            { $limit: 100 },
        ])
        .toArray();
    return {
        merchants: rows.map((r) => ({
            merchant: r._id,
            count: r.count,
            spent: Math.round(-r.spent * 100) / 100,
            lastDate: r.last,
        })),
    };
}
