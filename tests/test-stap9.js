/* De test die bij stap 9 hoort.

   Wat een raster over netwerkgrootte kan verbergen, en wat deze test daarom moet
   bewijzen:

   1. HET NETWERK IS ECHT ZO GROOT ALS DE CEL ZEGT. Een raster waarin `nNeurons` wel in
      de configuratie staat maar niet in het brein terechtkomt, levert vijf keer
      dezelfde meting op en ziet er precies uit als "grootte doet er niet toe". Dat is
      fout 12 uit stap 8 in een nieuwe jas, en het is hier de gevaarlijkste fout die er
      is, want de uitkomst zou geloofwaardig zijn.
   2. DE SOORTENVERDELING SCHAALT MEE EN KANTELT NIET. De grenzen worden per grootte
      geschaald; de controle is dat het aandeel per soort over de maten heen ongeveer
      gelijk blijft. Doet het dat niet, dan variëren er twee dingen tegelijk.
   3. DE STARTDICHTHEID DOET WAT ZIJ ZEGT, in dezelfde richting en meetbaar.
   4. DE UITKOMSTMAAT MEET DE STAND WAAROP GETRAIND IS. Op B-20 moet de fasemeting
      lager uitkomen dan de meting op taak A; zijn ze gelijk, dan leest de loper het
      verkeerde veld en meet het hele raster taak A.
   5. DE VEEG RAAKT DE MEETZADEN NIET.

   Draaien: tests\draai.cmd test-stap9.js s9-test-log.txt                             */
const { chromium } = require('playwright');
const path = require('path');
const { NEURONEN, DICHTHEDEN, soortgrenzen, VEEG_SEED0, VEEG_N, MEET_SEED0, MEET_N } = require('./stap9-condities');

let fout = 0;
const ok = (naam, goed, uitleg) => {
  console.log(`${goed ? 'OK  ' : 'FOUT'}  ${naam}${uitleg ? '   ' + uitleg : ''}`);
  if (!goed) fout++;
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* een brein bouwen zonder te trainen — goedkoop, en genoeg voor 1 t/m 3 */
  const bouw = (ov, zaad) => p.evaluate(([ov, zaad]) => {
    const W = window.__brain;
    const cfg = W.cfgOverride(W.readCfg(), ov);
    const B = W.createBrain(cfg, zaad);
    const comp = W.countKinds(B);
    const HID = 20;              /* 16 invoer + 4 uitvoer */
    return { neuronen: B.n - HID, verbindingen: B.from.length, comp,
      gevraagd: cfg.nNeurons, dichtheid: cfg.density };
  }, [ov, zaad]);

  /* ---------- 1. het netwerk is echt zo groot als de cel zegt ---------- */
  {
    const uit = [];
    for (const N of NEURONEN) uit.push(await bouw(Object.assign({ nNeurons: N }, soortgrenzen(N)), 1000));
    ok('elke cel levert het gevraagde aantal neuronen',
      uit.every(u => u.neuronen === u.gevraagd),
      uit.map(u => `${u.gevraagd}→${u.neuronen}`).join(' '));
    ok('en de vijf maten zijn werkelijk verschillend',
      new Set(uit.map(u => u.neuronen)).size === NEURONEN.length);
    ok('meer neuronen levert ook meer verbindingen op',
      uit.every((u, i) => i === 0 || u.verbindingen > uit[i - 1].verbindingen),
      uit.map(u => u.verbindingen).join(' → '));
  }

  /* ---------- 2. de soortenverdeling schaalt mee ---------- */
  {
    const aandeel = [];
    for (const N of NEURONEN) {
      /* over vier zaden, want de samenstelling wordt geloot binnen de grenzen */
      const acc = { sens: 0, work: 0, refl: 0, mem: 0, n: 0 };
      for (let z = 0; z < 4; z++) {
        const u = await bouw(Object.assign({ nNeurons: N }, soortgrenzen(N)), 1000 + z);
        for (const k of ['sens', 'work', 'refl', 'mem']) acc[k] += u.comp[k];
        acc.n += u.neuronen;
      }
      aandeel.push({ N, sens: acc.sens / acc.n, work: acc.work / acc.n,
        refl: acc.refl / acc.n, mem: acc.mem / acc.n });
    }
    for (const soort of ['sens', 'work', 'refl', 'mem']) {
      const v = aandeel.map(a => a[soort]);
      const spreiding = Math.max(...v) - Math.min(...v);
      ok(`het aandeel ${soort}-neuronen blijft over de maten heen ongeveer gelijk`,
        spreiding < 0.15,
        v.map(x => x.toFixed(2)).join(' ') + `  (spreiding ${spreiding.toFixed(2)})`);
    }
    ok('workers vormen overal de meerderheid', aandeel.every(a => a.work > 0.5),
      aandeel.map(a => a.work.toFixed(2)).join(' '));
  }

  /* ---------- 3. de dichtheid doet wat zij zegt ---------- */
  {
    const uit = [];
    for (const D of DICHTHEDEN) uit.push(await bouw(Object.assign({ nNeurons: 60, density: D }, soortgrenzen(60)), 1000));
    ok('een hogere startdichtheid levert meer verbindingen op',
      uit.every((u, i) => i === 0 || u.verbindingen > uit[i - 1].verbindingen),
      DICHTHEDEN.map((d, i) => `d=${d}:${uit[i].verbindingen}`).join('  '));
    ok('en het aantal neuronen verandert er niet van',
      new Set(uit.map(u => u.neuronen)).size === 1);
  }

  /* ---------- 4. de uitkomstmaat meet de stand waarop getraind is ---------- */
  {
    const leef = (blink) => p.evaluate(([blink, ov]) => {
      const W = window.__brain;
      let cfg = W.readCfg();
      cfg.nEpisodes = 120; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
      cfg = W.cfgOverride(cfg, Object.assign({}, ov, { goalBlink: blink, lr: 0.008 }));
      const row = W.runLeven(cfg, 1000, [{ naam: 'enig', pogingen: 120, ov: {} }], 's9-test',
        { benchN: 120, benchReps: 1, memN: 40, memBlind: 20, memH: 40 });
      const F = row.leven.fasen[0];
      return { eigen: F.opEigenTaak.pct, opA: F.opTaakA.pct, horizon: F.geheugenhorizon,
        blinkInCfg: row.config.wereld ? row.config.wereld.doelKnippert : null };
    }, [blink, Object.assign({ nNeurons: 60 }, soortgrenzen(60))]);

    const A = await leef(0), B20 = await leef(20);
    ok('op taak A zijn de twee metingen gelijk (zelfde stand, zelfde meting)',
      Math.abs(A.eigen - A.opA) < 1e-9, `${A.eigen} tegen ${A.opA}`);
    ok('op B-20 zijn zij niet gelijk — anders leest de loper het verkeerde veld',
      Math.abs(B20.eigen - B20.opA) > 1e-9, `${B20.eigen.toFixed(3)} tegen ${B20.opA.toFixed(3)}`);
    ok('en op B-20 ligt de eigen stand lager dan taak A',
      B20.eigen < B20.opA, 'knipperen hoort moeilijker te zijn dan niet knipperen');
    ok('elke meting is eindig en in bereik',
      [A, B20].every(x => [x.eigen, x.opA].every(v => isFinite(v) && v >= 0 && v <= 1)));
    ok('de geheugenhorizon is eindig en niet negatief',
      [A, B20].every(x => x.horizon === null || (isFinite(x.horizon) && x.horizon >= 0)),
      `A ${A.horizon}, B-20 ${B20.horizon}`);
  }

  /* ---------- 5. de veeg raakt de meetzaden niet ---------- */
  {
    const veeg = new Set(); for (let k = 0; k < VEEG_N; k++) veeg.add(VEEG_SEED0 + k);
    const meet = new Set(); for (let k = 0; k < MEET_N; k++) meet.add(MEET_SEED0 + k);
    ok('veegzaden en meetzaden overlappen niet',
      [...veeg].every(z => !meet.has(z)),
      `veeg ${[...veeg].join(',')} · meet ${[...meet][0]}..${[...meet][meet.size - 1]}`);
  }

  if (fouten.length) { console.error('paginafouten:\n' + fouten.join('\n')); fout++; }
  console.log(fout ? `\n${fout} controle(s) MISLUKT` : '\nalle controles groen');
  process.exitCode = fout ? 1 : 0;
  await b.close();
})();
