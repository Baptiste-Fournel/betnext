import { DataSource } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { TypeOrmBetRepository } from './TypeOrmBetRepository';
import { TypeOrmUnitOfWork } from './TypeOrmUnitOfWork';
import { BetRecord } from './BetRecord';
import { BetEventRecord } from './BetEventRecord';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { Bet } from '../../domain/Bet';
import { Odds } from '../../../../shared-kernel/domain/Odds';

// NB : pg-mem ne supporte ni plpgsql/triggers ni le rollback transactionnel. Le schéma de test
// est créé par `synchronize` (entités). Donc : (a) l'append-only AU NIVEAU BASE (trigger de la
// migration) et (b) l'isolation/rollback transactionnel sont garantis par Postgres au RUNTIME.
// Ici on prouve ce qui est testable sur pg-mem : append-only AU NIVEAU ADAPTER (aucune mutation
// des événements antérieurs) et propagation du manager de la UnitOfWork au repository.
async function newDataSource(): Promise<DataSource> {
  const db = newDb();
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });
  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'betnext',
  });
  const ds: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [BetRecord, BetEventRecord],
    synchronize: false,
  });
  await ds.initialize();
  await ds.synchronize();
  return ds;
}

describe('TypeOrmBetRepository (pg-mem)', () => {
  let ds: DataSource;
  let context: TransactionContext;
  let repo: TypeOrmBetRepository;

  beforeEach(async () => {
    ds = await newDataSource();
    context = new TransactionContext();
    repo = new TypeOrmBetRepository(ds, context);
  });

  afterEach(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it("persiste lockedOdds ET potentialGain figés, relus À L'IDENTIQUE", async () => {
    const bet = Bet.place({
      id: 'b1',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 20,
      currentOdds: Odds.of(2.5),
    });
    await repo.save(bet);

    const reloaded = await repo.findById('b1');
    expect(reloaded).not.toBeNull();
    expect(reloaded!.lockedOdds.value).toBe(2.5);
    expect(reloaded!.potentialGain).toBe(50);
    expect(reloaded!.stake).toBe(20);
  });

  it('relit potentialGain depuis la COLONNE (preuve : aucun recalcul stake×cote)', async () => {
    // Snapshot dont le potentialGain stocké DIFFÈRE de stake×cote (10×2=20).
    await ds.getRepository(BetRecord).insert({
      id: 'bx',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 10,
      lockedOdds: 2,
      potentialGain: 999,
      status: 'PENDING',
      createdAt: new Date(),
    });
    const reloaded = await repo.findById('bx');
    expect(reloaded!.potentialGain).toBe(999); // la valeur stockée, pas 20
  });

  it('journalise BetPlaced dans le journal append-only', async () => {
    const bet = Bet.place({
      id: 'b2',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 10,
      currentOdds: Odds.of(2),
    });
    await repo.save(bet);

    const history = await repo.history('b2');
    expect(history.map((e) => e.type)).toEqual(['BetPlaced']);
    expect(history[0].payload).toMatchObject({ outcomeId: 'o1', stake: 10, lockedOdds: 2 });
  });

  it('APPEND strict : une transition ajoute un événement SANS muter les précédents', async () => {
    const bet = Bet.place({
      id: 'b3',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 10,
      currentOdds: Odds.of(2),
    });
    await repo.save(bet);
    const afterFirst = await repo.history('b3');
    expect(afterFirst).toHaveLength(1);
    const firstEvent = afterFirst[0];

    bet.win();
    await repo.save(bet);

    const afterSecond = await repo.history('b3');
    expect(afterSecond.map((e) => e.type)).toEqual(['BetPlaced', 'BetWon']);
    expect(afterSecond[0].seq).toBe(firstEvent.seq);
    expect(afterSecond[0].payload).toEqual(firstEvent.payload);

    const reloaded = await repo.findById('b3');
    expect(reloaded!.status).toBe('WON');
    expect(reloaded!.lockedOdds.value).toBe(2);
  });

  it('couture BET-5 : save REJOINT la transaction de la UnitOfWork (manager propagé + commit)', async () => {
    const uow = new TypeOrmUnitOfWork(ds, context);
    const bet = Bet.place({
      id: 'b4',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 10,
      currentOdds: Odds.of(2),
    });

    let managerPropagated = false;
    await uow.withTransaction(async () => {
      managerPropagated = context.getManager() !== undefined; // la UoW publie son manager
      await repo.save(bet); // le repo le récupère et rejoint la transaction
    });

    expect(managerPropagated).toBe(true);
    expect(context.getManager()).toBeUndefined(); // contexte nettoyé après la transaction
    const reloaded = await repo.findById('b4');
    expect(reloaded).not.toBeNull();
    expect((await repo.history('b4')).map((e) => e.type)).toEqual(['BetPlaced']);
  });
});
