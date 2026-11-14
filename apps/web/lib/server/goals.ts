import type { Goal, GoalEntry } from '@/lib/goals/model';
import { collections, type GoalDoc, type GoalEntryDoc } from './db';
import { invalid, isDate, isNumber, isString, newId, notFound, oneOf, optionalText, requiredText } from './userRoute';

const toGoal = ({ email: _e, _id, ...rest }: GoalDoc): Goal => ({ ...rest, id: _id }) as Goal;
const toEntry = ({ email: _e, _id, ...rest }: GoalEntryDoc): GoalEntry => ({ ...rest, id: _id });

type GoalFields = Pick<GoalDoc, 'name' | 'icon' | 'color' | 'better'> & {
    description?: string;
    unit?: string;
    target?: number;
};

function fields(body: Record<string, unknown>, partial: boolean): Partial<GoalFields> & { clearTarget?: boolean } {
    const out: Partial<GoalFields> & { clearTarget?: boolean } = {};
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name');
    if ('description' in body) out.description = optionalText(body.description, 'description');
    if ('unit' in body) out.unit = optionalText(body.unit, 'unit', 20);
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if (!partial || 'better' in body)
        out.better = oneOf(body.better ?? 'higher', ['higher', 'lower'] as const, 'better');
    if ('target' in body) {
        if (body.target === null || body.target === undefined) out.clearTarget = true;
        else if (isNumber(body.target)) out.target = body.target;
        else throw invalid('target must be a number.');
    }
    return out;
}

function entryFields(body: Record<string, unknown>) {
    if (!isNumber(body.value)) throw invalid('value must be a number.');
    if (!isDate(body.date)) throw invalid('date must be YYYY-MM-DD.');
    return { value: body.value, date: body.date, note: optionalText(body.note, 'note', 280) };
}

export async function listGoals(email: string) {
    const [goals, entries] = await Promise.all([collections.goals(), collections.goalEntries()]);
    const [g, e] = await Promise.all([
        goals.find({ email }).sort({ order: 1 }).toArray(),
        entries.find({ email }).sort({ date: 1, createdAt: 1 }).toArray(),
    ]);
    return { goals: g.map(toGoal), entries: e.map(toEntry) };
}

export async function createGoal(email: string, body: Record<string, unknown>): Promise<Goal> {
    const goals = await collections.goals();
    const last = await goals.find({ email }).sort({ order: -1 }).limit(1).next();
    const { clearTarget: _c, ...f } = fields(body, false);
    const stamp = new Date().toISOString();
    const doc: GoalDoc = {
        ...(f as GoalFields),
        _id: newId(),
        email,
        order: (last?.order ?? 0) + 1,
        createdAt: stamp,
        updatedAt: stamp,
    };
    for (const k of ['description', 'unit', 'target'] as const) if (doc[k] === undefined) delete doc[k];
    await goals.insertOne(doc);
    return toGoal(doc);
}

export async function updateGoal(email: string, id: string, body: Record<string, unknown>): Promise<Goal> {
    const goals = await collections.goals();
    const { clearTarget, ...f } = fields(body, true);
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const unset: Record<string, ''> = {};
    for (const [k, v] of Object.entries(f)) {
        if (v === undefined) unset[k] = '';
        else set[k] = v;
    }
    if (clearTarget) unset.target = '';
    const doc = await goals.findOneAndUpdate(
        { _id: id, email },
        { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { returnDocument: 'after' },
    );
    if (!doc) throw notFound();
    return toGoal(doc);
}

export async function deleteGoal(email: string, id: string): Promise<void> {
    const [goals, entries] = await Promise.all([collections.goals(), collections.goalEntries()]);
    const { deletedCount } = await goals.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    await entries.deleteMany({ email, goalId: id });
}

export async function addEntry(email: string, goalId: string, body: Record<string, unknown>): Promise<GoalEntry> {
    const [goals, entries] = await Promise.all([collections.goals(), collections.goalEntries()]);
    if (!(await goals.countDocuments({ _id: goalId, email }, { limit: 1 }))) throw notFound();
    const { note, ...rest } = entryFields(body);
    const doc: GoalEntryDoc = {
        _id: newId(),
        email,
        goalId,
        ...rest,
        ...(note ? { note } : {}),
        createdAt: new Date().toISOString(),
    };
    await entries.insertOne(doc);
    return toEntry(doc);
}

export async function deleteEntry(email: string, id: string): Promise<void> {
    const entries = await collections.goalEntries();
    const { deletedCount } = await entries.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
}

export async function importGoals(email: string, body: Record<string, unknown>) {
    const rawGoals = Array.isArray(body.goals) ? body.goals : [];
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    if (rawGoals.length > 200 || rawEntries.length > 50_000) throw invalid('Too much to import at once.');

    const [goals, entries] = await Promise.all([collections.goals(), collections.goalEntries()]);
    const ids = new Set<string>();
    const goalOps = rawGoals.map((raw: Record<string, unknown>) => {
        if (!isString(raw.id, 64) || !raw.id) throw invalid('Each goal needs an id.');
        ids.add(raw.id);
        const { clearTarget: _c, ...f } = fields(raw, false);
        const stamp = new Date().toISOString();
        const doc: GoalDoc = {
            ...(f as GoalFields),
            _id: raw.id,
            email,
            order: isNumber(raw.order) ? raw.order : 0,
            createdAt: isString(raw.createdAt, 40) ? raw.createdAt : stamp,
            updatedAt: isString(raw.updatedAt, 40) ? raw.updatedAt : stamp,
        };
        for (const k of ['description', 'unit', 'target'] as const) if (doc[k] === undefined) delete doc[k];
        return { updateOne: { filter: { _id: doc._id, email }, update: { $setOnInsert: doc }, upsert: true } };
    });
    const entryOps = rawEntries
        .filter(
            (e: Record<string, unknown>) => isString(e.goalId, 64) && ids.has(e.goalId) && isString(e.id, 64) && e.id,
        )
        .map((e: Record<string, unknown>) => {
            const { note, ...rest } = entryFields(e);
            const doc: GoalEntryDoc = {
                _id: e.id as string,
                email,
                goalId: e.goalId as string,
                ...rest,
                ...(note ? { note } : {}),
                createdAt: isString(e.createdAt, 40) ? e.createdAt : new Date().toISOString(),
            };
            return { updateOne: { filter: { _id: doc._id, email }, update: { $setOnInsert: doc }, upsert: true } };
        });

    if (goalOps.length) await goals.bulkWrite(goalOps, { ordered: false });
    if (entryOps.length) await entries.bulkWrite(entryOps, { ordered: false });
    return { goals: goalOps.length, entries: entryOps.length };
}
