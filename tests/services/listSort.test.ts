import { beforeEach, describe, expect, it } from 'vitest';
import { createRequest, listRequests } from '@/services/requests';
import { listDocuments } from '@/services/documentQueries';
import { prepareDocument } from '@/services/documents';
import { pageIdsByPriority } from '@/services/context';
import { resetDb, seedMinimal, type Fixture } from '../setup/db';

let f: Fixture;

describe('list sorting', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('pageIdsByPriority ranks HIGH > NORMAL > LOW (not alphabetically)', () => {
    const rows = [
      { id: 'a', priority: 'LOW', tiebreak: '1' },
      { id: 'b', priority: 'HIGH', tiebreak: '2' },
      { id: 'c', priority: 'NORMAL', tiebreak: '3' },
    ];
    expect(pageIdsByPriority(rows, 'desc', 0, 10)).toEqual(['b', 'c', 'a']);
    expect(pageIdsByPriority(rows, 'asc', 0, 10)).toEqual(['a', 'c', 'b']);
    expect(pageIdsByPriority(rows, 'desc', 1, 1)).toEqual(['c']);
  });

  it('requests sort by priority rank, paginated, and accept clientName/scopeName', async () => {
    for (const priority of ['LOW', 'HIGH', 'NORMAL', 'HIGH'] as const) {
      await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'x', priority });
    }
    const desc = await listRequests(f.officer, { sort: 'priority', dir: 'desc' });
    expect(desc.items.map((r) => r.priority)).toEqual(['HIGH', 'HIGH', 'NORMAL', 'LOW']);
    const asc = await listRequests(f.officer, { sort: 'priority', dir: 'asc' });
    expect(asc.items.map((r) => r.priority)).toEqual(['LOW', 'NORMAL', 'HIGH', 'HIGH']);
    const p2 = await listRequests(f.officer, { sort: 'priority', dir: 'desc', page: 2, pageSize: 3 });
    expect(p2.items.map((r) => r.priority)).toEqual(['LOW']);
    for (const sort of ['clientName', 'scopeName', 'number', 'status', 'createdAt']) {
      expect((await listRequests(f.officer, { sort, dir: 'asc' })).total).toBe(4);
    }
  });

  it('documents sort by priority rank and accept clientName/type/version/requestNumber', async () => {
    for (const priority of ['LOW', 'HIGH', 'NORMAL'] as const) {
      const r = await createRequest(f.officer, { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'x', priority });
      await prepareDocument(f.officer, r.id);
    }
    const desc = await listDocuments(f.officer, { sort: 'priority', dir: 'desc' });
    expect(desc.items.map((d) => d.priority)).toEqual(['HIGH', 'NORMAL', 'LOW']);
    for (const sort of ['clientName', 'type', 'version', 'requestNumber', 'number', 'status', 'updatedAt']) {
      expect((await listDocuments(f.officer, { sort, dir: 'asc' })).total).toBe(3);
    }
  });
});
