import { MAX_STEPS, MAX_WAIT_MINUTES, type Routine, type RoutineRun, type RoutineStep } from '@/lib/routines/model';
import { collections, type RoutineDoc, type RoutineRunDoc } from './db';
import { invalid, isDate, isNumber, isString, newId, notFound, requiredText } from './userRoute';

const toRoutine = ({ email: _e, _id, ...rest }: RoutineDoc): Routine => ({ ...rest, id: _id }) as Routine;
const toRun = ({ email: _e, _id: _i, ...rest }: RoutineRunDoc): RoutineRun => rest;
const runId = (routineId: string, date: string) => `${routineId}|${date}`;

function steps(raw: unknown): RoutineStep[] {
    if (!Array.isArray(raw)) throw invalid('steps must be a list.');
    if (raw.length > MAX_STEPS) throw invalid(`A routine can have up to ${MAX_STEPS} steps.`);
    const ids = new Set<string>();
    return raw.map((s: Record<string, unknown>) => {
        const id = isString(s?.id, 64) && s.id ? s.id : newId();
        if (ids.has(id)) throw invalid('Step ids must be unique.');
        ids.add(id);
        if (s?.kind === 'task') return { id, kind: 'task', title: requiredText(s.title, 'step title', 120) };
        if (s?.kind === 'wait') {
            if (!isNumber(s.minutes) || s.minutes < 1 || s.minutes > MAX_WAIT_MINUTES || !Number.isInteger(s.minutes)) {
                throw invalid(`A wait is 1 to ${MAX_WAIT_MINUTES} whole minutes.`);
            }
            return { id, kind: 'wait', minutes: s.minutes };
        }
        throw invalid('Each step is a task or a wait.');
    });
}

type Fields = Pick<RoutineDoc, 'name' | 'icon' | 'color' | 'steps'> & { habitId?: string };

function fields(body: Record<string, unknown>, partial: boolean): Partial<Fields> & { clearHabit?: boolean } {
    const out: Partial<Fields> & { clearHabit?: boolean } = {};
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name');
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if (!partial || 'steps' in body) out.steps = steps(body.steps ?? []);
    if ('habitId' in body) {
        if (body.habitId === null || body.habitId === undefined || body.habitId === '') out.clearHabit = true;
        else if (isString(body.habitId, 64)) out.habitId = body.habitId;
        else throw invalid('habitId is invalid.');
    }
    return out;
}

export async function listRoutines(email: string, date: string) {
    if (!isDate(date)) throw invalid('date must be YYYY-MM-DD.');
    const [routines, runs] = await Promise.all([collections.routines(), collections.routineRuns()]);
    const [r, ru] = await Promise.all([
        routines.find({ email }).sort({ order: 1 }).toArray(),
        runs.find({ email, date }).toArray(),
    ]);
    return { routines: r.map(toRoutine), runs: ru.map(toRun) };
}

export async function createRoutine(email: string, body: Record<string, unknown>): Promise<Routine> {
    const routines = await collections.routines();
    const last = await routines.find({ email }).sort({ order: -1 }).limit(1).next();
    const { clearHabit: _c, ...f } = fields(body, false);
    const stamp = new Date().toISOString();
    const doc: RoutineDoc = {
        ...(f as Fields),
        _id: newId(),
        email,
        order: (last?.order ?? 0) + 1,
        createdAt: stamp,
        updatedAt: stamp,
    };
    if (!doc.habitId) delete doc.habitId;
    await routines.insertOne(doc);
    return toRoutine(doc);
}

export async function updateRoutine(email: string, id: string, body: Record<string, unknown>): Promise<Routine> {
    const routines = await collections.routines();
    const { clearHabit, ...f } = fields(body, true);
    const doc = await routines.findOneAndUpdate(
        { _id: id, email },
        {
            $set: { ...f, updatedAt: new Date().toISOString() },
            ...(clearHabit ? { $unset: { habitId: '' as const } } : {}),
        },
        { returnDocument: 'after' },
    );
    if (!doc) throw notFound();
    return toRoutine(doc);
}

export async function deleteRoutine(email: string, id: string): Promise<void> {
    const [routines, runs] = await Promise.all([collections.routines(), collections.routineRuns()]);
    const { deletedCount } = await routines.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    await runs.deleteMany({ email, routineId: id });
}

export async function saveRun(
    email: string,
    routineId: string,
    date: string,
    body: Record<string, unknown>,
): Promise<RoutineRun> {
    if (!isDate(date)) throw invalid('date must be YYYY-MM-DD.');
    const [routines, runs] = await Promise.all([collections.routines(), collections.routineRuns()]);
    const routine = await routines.findOne({ _id: routineId, email });
    if (!routine) throw notFound();

    const stepIds = new Set(routine.steps.map((s) => s.id));
    const ids = (v: unknown, field: string) => {
        if (!Array.isArray(v) || !v.every((x) => isString(x, 64)))
            throw invalid(`${field} must be a list of step ids.`);
        return [...new Set(v as string[])].filter((x) => stepIds.has(x));
    };
    const waits: Record<string, string> = {};
    if (body.waits && typeof body.waits === 'object') {
        for (const [k, v] of Object.entries(body.waits as Record<string, unknown>)) {
            if (stepIds.has(k) && isString(v, 40) && !Number.isNaN(Date.parse(v))) waits[k] = v;
        }
    }
    const completedAt = isString(body.completedAt, 40) && body.completedAt ? body.completedAt : undefined;
    const doc: RoutineRunDoc = {
        _id: runId(routineId, date),
        email,
        routineId,
        date,
        done: ids(body.done ?? [], 'done'),
        waits,
        skipped: ids(body.skipped ?? [], 'skipped'),
        ...(completedAt ? { completedAt } : {}),
        updatedAt: new Date().toISOString(),
    };
    await runs.replaceOne({ _id: doc._id, email }, doc, { upsert: true });
    return toRun(doc);
}

export async function resetRun(email: string, routineId: string, date: string): Promise<void> {
    if (!isDate(date)) throw invalid('date must be YYYY-MM-DD.');
    const runs = await collections.routineRuns();
    await runs.deleteOne({ _id: runId(routineId, date), email });
}
