/* De test die bij stap 19 hoort — spel 3, de proeftuin, en het verbindingsbudget.

   WAT DEZE TEST BEWIJST, en wat niet.

   1. SPEL 1 IS ONVERANDERD. s13-ang en s13-elman-16-bp reproduceren bit voor bit tegen de
      bewaarde referentieruns. Dat dekt meteen het meeste van wat stap 19 heeft aangeraakt:
      s13-ang loopt negenhonderd pogingen lang door restructure() heen, waar het
      verbindingsbudget is ingebouwd, en door het categorische beleid, waar de actielijst
      nu uit een functie komt.
   2. DE NIEUWE KNOPPEN ZIJN INERT IN HUN UITSTAND. actiesVoor() geeft per spel exact
      dezelfde lijst terug als de regel die er stond (identiteit, niet gelijkheid), en
      budgetAfdwingen() doet bij budget 0 niets en haalt sowieso geen trekking uit de
      toevalsreeks — hij krijgt er niet eens een.
      Spel 2 wordt hier alleen op die twee punten geraakt; tests/test-stap17.js en
      tests/test-stap18.js blijven de referentie voor het seinhuis zelf en horen groen te
      blijven.
   3. DE SCORE VAN SPEL 3 HEEFT EEN SCHAAL. Perfect 100 %, altijd dezelfde bak 0 %, een
      munt van vier kanten 0 %, niets doen -33,3 %, vier losse Bernoulli-knoppen -25 %.
      Een score op een nieuw spel is een getal zonder schaal zolang bodem en plafond niet
      gemeten zijn (vaste regel, stap 17).
   4. DE KRUISTABEL KLOPT. De oplossing van elke fase, gescoord op alle vijf de regels.
      Dat is geen formaliteit: hij laat zien dat fase C voor een derde uit de oplossing van
      fase A volgt (34,6 %) en dat fase B onder nul begint (-33,3 %). Wie "herstel" meet
      zonder die startwaarden, meet iets anders dan hij denkt.
   5. DE TAAK VERSCHUIFT ECHT. Voor elke fase hangt het antwoord van een perfecte speler af
      van precies de eigenschappen die in die fase meetellen, en van de andere niet. De zes
      afleiders leveren de ruisbodem van die maat.
   6. HET BUDGET BINDT. Met een plafond blijft het aantal verbindingen eronder, bij de
      geboorte en na zestig herstructureringsronden; zonder plafond verandert er niets.
   7. DE PAGINA VALT NIET OM. Spel 3 kiezen en op start drukken geeft geen enkele
      paginafout — de fout van stap 17 zat in updateStatus en een headless test dekt geen
      pagina die iemand moet kunnen openen.
   8. EEN LEVEN OVER DE VIJF FASEN LOOPT, en levert op elke fasegrens de score op alle vijf
      de regels.

   Draaien: tests\draai.cmd test-stap19.js s19-test-log.txt                              */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.resolve('experimenten');
let fout = 0;
const ok = (naam, goed, uitleg) => {
  console.log(`${goed ? 'OK  ' : 'FOUT'}  ${naam}${uitleg ? '   ' + uitleg : ''}`);
  if (!goed) fout++;
};
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bij = (a, b, tol) => a !== null && Math.abs(a - b) <= tol;
const pc = x => x === null ? 'null' : (100 * x).toFixed(1) + '%';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1. spel 1 onveranderd ---------- */
  {
    const { FASEN, CONDITIES, MEET_SEED0 } = require('./stap13-condities');
    const { STAGVENSTER } = require('./stap16-condities');
    const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
    const MEETPUNT = { benchN: 200, benchReps: 1, memN: 50, memBlind: 20, memH: 40 };
    for (const naam of ['ang', 'elman-16-bp']) {
      const c = CONDITIES.find(x => x.naam === naam);
      const pad = path.join(OUT, 'runs', `s13-${naam}_z${MEET_SEED0}.json`);
      if (!fs.existsSync(pad)) { ok(`s13-${naam} reproduceert`, false, 'referentiebestand ontbreekt'); continue; }
      const oud = JSON.parse(fs.readFileSync(pad, 'utf8'));
      const nieuw = await p.evaluate(([zaad, fasen, meet, totaal, stag, lr, ov]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = totaal; cfg.evalOn = false;
        cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 1;
        cfg.memOn = true; cfg.memN = 100;
        cfg = W.cfgOverride(cfg, Object.assign({ lr, stagVenster: stag }, ov));
        return W.runLeven(cfg, zaad, fasen, 's19-controle', meet);
      }, [MEET_SEED0, FASEN, MEETPUNT, TOTAAL, STAGVENSTER, c.lr, c.ov]);
      const h = gelijk(oud.historie, nieuw.historie), n = gelijk(oud.netwerk, nieuw.netwerk);
      ok(`spel 1: s13-${naam} geeft bit voor bit hetzelfde leven`, h && n, `historie ${h}, netwerk ${n}`);
    }
  }

  /* ---------- 2. de nieuwe knoppen zijn inert ---------- */
  {
    const r = await p.evaluate(() => {
      const W = window.__brain;
      return {
        doel: W.actiesVoor({ taak: 'doel' }) === W.CAT_ACTIES,
        sein: W.actiesVoor({ taak: 'seinhuis' }) === W.SEIN_ACTIES,
        tuin: W.actiesVoor({ taak: 'proeftuin' }) === W.TUIN.ACTIES,
        onbekend: W.actiesVoor({ taak: 'iets-anders' }) === W.CAT_ACTIES,
        /* budget 0 verandert niets aan een vers brein */
        nul: (() => {
          const cfg = W.cfgOverride(W.readCfg(), { connBudget: 0 });
          const A = W.createBrain(cfg, 4242), Bb = W.createBrain(W.readCfg(), 4242);
          return A.nc === Bb.nc;
        })(),
        /* budgetAfdwingen is deterministisch en krijgt geen toevalsgenerator */
        argN: W.budgetAfdwingen.length
      };
    });
    ok('actiesVoor geeft per spel dezelfde lijst als voorheen',
      r.doel && r.sein && r.tuin && r.onbekend, `doel ${r.doel}, seinhuis ${r.sein}, proeftuin ${r.tuin}`);
    ok('budget 0 laat het startbrein ongemoeid', r.nul);
    ok('budgetAfdwingen krijgt geen toevalsgenerator', r.argN === 3, `${r.argN} argumenten`);
  }

  /* ---------- 3, 4 en 5. de schaal, de kruistabel en de verschuiving ---------- */
  const speler = (soort, fase) => p.evaluate(([soort, fase]) => {
    const W = window.__brain, T = W.TUIN;
    const cfg = { tuinTikken: 200 };
    const tel = W.tuinLeegTelling();
    const rnd = W.mulberry32(12345);
    const P = [false, false, false, false];
    for (let k = 0; k < 25; k++) {
      const d = W.tuinRonde(9000000 + k * 31, cfg);
      for (let t = 0; t < d.T; t++) {
        P[0] = P[1] = P[2] = P[3] = false;
        if (soort === 'perfect') P[W.tuinBak(fase, d.kleur[t], d.bew[t], d.gro[t], d.geur[t])] = true;
        else if (soort === 'vast') P[0] = true;
        else if (soort === 'munt') P[Math.floor(rnd() * 4)] = true;
        else if (soort === 'bernoulli') { for (let i = 0; i < 4; i++) P[i] = rnd() < 0.5; }
        W.tuinTel(tel, d, t, P);
      }
    }
    const afh = W.tuinAfhankelijkheid(tel);
    return {
      scores: [0, 1, 2, 3, 4].map(f => W.tuinScore(tel.n, tel.g, f * T.BAKKEN)),
      groep: afh.slice(0, 4), bodem: afh.slice(4).every(x => x === null) ? null
        : afh.slice(4).reduce((a, x) => a + x, 0) / (T.AFL)
    };
  }, [soort, fase]);
  {
    const vast = await speler('vast', 0), munt = await speler('munt', 0),
      niets = await speler('niets', 0), bern = await speler('bernoulli', 0);
    const perf = [];
    for (let f = 0; f < 5; f++) perf.push(await speler('perfect', f));

    ok('plafond: een perfecte speler haalt 100 % op zijn eigen fase',
      perf.every((r, f) => bij(r.scores[f], 1, 1e-9)), perf.map((r, f) => pc(r.scores[f])).join(' '));
    ok('altijd dezelfde bak staat op nul, op elke regel',
      vast.scores.every(x => bij(x, 0, 1e-9)), vast.scores.map(pc).join(' '));
    ok('een munt van vier kanten staat op nul, op elke regel',
      munt.scores.every(x => bij(x, 0, 0.03)), munt.scores.map(pc).join(' '));
    ok('niets doen staat op -33,3 % (de vloer bij vier bakken)',
      niets.scores.every(x => bij(x, -1 / 3, 1e-9)), niets.scores.map(pc).join(' '));
    ok('vier losse Bernoulli-knoppen staan op de voorspelde -25 %',
      bern.scores.every(x => bij(x, -0.25, 0.03)), bern.scores.map(pc).join(' '));
    ok('de toevalsbodem klopt met tuinToeval()',
      await p.evaluate(() => window.__brain.tuinToeval({ catPolicy: true }) === 0 &&
        Math.abs(window.__brain.tuinToeval({ catPolicy: false }) + 0.25) < 1e-12));

    console.log('      kruistabel — rij = de oplossing van die fase, kolom = de regel waarop gescoord wordt');
    console.log('      ' + 'oplossing'.padEnd(12) + ['A', 'B', 'C', 'D', "A'"].map(x => x.padStart(8)).join(''));
    perf.forEach((r, f) => console.log('      ' + ('fase ' + ['A','B','C','D',"A'"][f]).padEnd(12) +
      r.scores.map(x => pc(x).padStart(8)).join('')));

    /* de twee waarden waar een hersteltijd tegen afgemeten moet worden */
    ok('fase B begint maximaal fout voor wie fase A kent (-33,3 %)',
      bij(perf[0].scores[1], -1 / 3, 1e-9), pc(perf[0].scores[1]));
    ok('fase C ligt voor een derde al in de oplossing van fase A',
      bij(perf[0].scores[2], 0.3457, 0.01), pc(perf[0].scores[2]));
    ok('fase D deelt niets met de eerdere fasen', bij(perf[0].scores[3], 0, 0.03), pc(perf[0].scores[3]));
    ok("fase A' is letterlijk fase A", gelijk(perf[0].scores, perf[4].scores));

    /* de verschuiving */
    const NAAM = ['kleur', 'beweging', 'grootte', 'geur'];
    const HOORT = [['kleur'], ['kleur'], ['kleur', 'beweging'], ['geur', 'grootte'], ['kleur']];
    let goed = true, uitleg = [];
    perf.forEach((r, f) => {
      NAAM.forEach((g, gi) => {
        const telt = HOORT[f].includes(g), v = r.groep[gi];
        if (telt ? !(v > 0.30) : !(v < 0.05)) { goed = false; uitleg.push(`fase ${f} ${g}=${v.toFixed(2)}`); }
      });
      if (!(r.bodem < 0.05)) { goed = false; uitleg.push(`fase ${f} afleiders=${r.bodem.toFixed(3)}`); }
    });
    ok('het antwoord hangt in elke fase van precies de goede eigenschappen af', goed, uitleg.join(', '));
    ok('de zes afleiders blijven overal onder 5 % (de ruisbodem van de maat)',
      perf.every(r => r.bodem < 0.05) && vast.bodem < 1e-9,
      'perfect ' + perf.map(r => r.bodem.toFixed(3)).join('/') + ', vast ' + vast.bodem.toFixed(3));
  }

  /* ---------- 5b. de beloning is wat er staat (stap 20) ---------- */
  {
    const r = await p.evaluate(() => {
      const W = window.__brain, S = W.S;
      const d = W.tuinRonde(1, { tuinTikken: 20 });
      const moet = W.tuinBak(0, d.kleur[0], d.bew[0], d.gro[0], d.geur[0]);
      const ander = (moet + 1) % 4, P = i => [0, 1, 2, 3].map(k => i.includes(k));
      const r = keuze => W.tuinScoreTik(d, 0, P(keuze), 0).r;
      return { goed: r([moet]), fout: r([ander]), niets: r([]), goedPlus: r([moet, ander]), foutPlus: r([ander, (moet + 2) % 4]) };
    });
    ok('beloning: goed +1, fout -1, niets -1, elke handel boven de eerste -0,5',
      r.goed === 1 && r.fout === -1 && r.niets === -1 && r.goedPlus === 0.5 && r.foutPlus === -1.5, JSON.stringify(r));
  }

  /* ---------- 6. het budget bindt ---------- */
  {
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const proef = budget => {
        const cfg = W.cfgOverride(W.readCfg(), { connBudget: budget, structOn: true,
          growOn: true, retypeOn: true, growStagnant: false, pruneT: 0.05 });
        const B = W.createBrain(cfg, 1234);
        const start = B.nc;
        const rnd = W.mulberry32(77);
        let max = start;
        for (let i = 0; i < 60; i++) { W.restructure(B, cfg, rnd, true); if (B.nc > max) max = B.nc; }
        return { start, eind: B.nc, max };
      };
      return { zonder: proef(0), met: proef(1200), krap: proef(600) };
    });
    ok('zonder budget groeit het net gewoon door', r.zonder.max > 1200,
      `start ${r.zonder.start}, max ${r.zonder.max}, eind ${r.zonder.eind}`);
    ok('met budget 1200 komt het er nooit boven', r.met.start <= 1200 && r.met.max <= 1200,
      `start ${r.met.start}, max ${r.met.max}, eind ${r.met.eind}`);
    ok('met budget 600 komt het er nooit boven', r.krap.start <= 600 && r.krap.max <= 600,
      `start ${r.krap.start}, max ${r.krap.max}, eind ${r.krap.eind}`);
    ok('het budget snijdt werkelijk, het is geen dode knop',
      r.met.start < r.zonder.start && r.krap.start < r.met.start,
      `${r.zonder.start} -> ${r.met.start} -> ${r.krap.start}`);
  }

  /* ---------- 8. een leven over de vijf fasen ---------- */
  let leven = null;
  {
    leven = await p.evaluate(() => {
      const W = window.__brain, T = W.TUIN;
      const fasen = T.FASENAAM.map((naam, i) => ({ naam, pogingen: 12, ov: { tuinFase: i } }));
      let cfg = W.cfgOverride(W.readCfg(), { taak: 'proeftuin', worldEvery: 1, catPolicy: true,
        tuinTikken: 60, connBudget: 1200, nNeurons: 30 });
      cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 8;
      cfg.benchReps = 1; cfg.memOn = false;
      const row = W.runLeven(cfg, 1000, fasen, 's19-proefleven', { benchN: 8, benchReps: 1 });
      return { fasen: row.leven.fasen.map(f => ({ naam: f.fase, eigen: f.opEigenTaak && f.opEigenTaak.pct })),
        proeftuin: !!row.proeftuin, metabool: row.metabool,
        perFase: row.benchmark && row.benchmark.beleid.perFase ? Object.keys(row.benchmark.beleid.perFase) : null,
        kanaal: row.benchmark && row.benchmark.beleid.kanaalafhankelijkheid || null,
        bodem: row.benchmark && row.benchmark.beleid.afleiderbodem,
        geheugen: row.geheugen };
    });
    ok('een leven over de vijf fasen loopt door', leven.fasen.length === 5,
      leven.fasen.map(f => f.naam.split(' ')[0] + ' ' + pc(f.eigen)).join('  '));
    ok('het resultaat draagt een proeftuin-blok en een metabole boekhouding',
      leven.proeftuin && leven.metabool && leven.metabool.verbindingsbudget === 1200,
      JSON.stringify(leven.metabool));
    ok('de benchmark geeft de score op alle vijf de regels',
      gelijk(leven.perFase, ['A', 'B', 'C', 'D', 'A2']), JSON.stringify(leven.perFase));
    ok('de blinderingsproef doet in spel 3 niets', leven.geheugen === null);
    ok('het net blijft binnen het budget', leven.metabool.verbindingenNu <= 1200,
      `${leven.metabool.verbindingenNu} van 1200`);
  }

  /* ---------- 8b. de stille nul is niet stil ---------- */
  {
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const proef = prop => {
        let cfg = W.cfgOverride(W.readCfg(), { taak: 'proeftuin', worldEvery: 1, catPolicy: true,
          tuinTikken: 120, tuinFase: 0, lr: 0.008, prop, layered: true, layerSizes: [32],
          gradExact: true, structOn: false, growOn: false, retypeOn: false });
        cfg.nEpisodes = 120; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 10;
        cfg.benchReps = 1; cfg.memOn = false;
        const row = W.runOne(cfg, 1000, 's19-prop' + prop);
        return { J: row.benchmark.beleid.perFase.A.pct, kan: row.proeftuin.kanReageren,
          prop: row.proeftuin.propagatiestappen,
          kleur: row.benchmark.beleid.kanaalafhankelijkheid.kleur,
          bodem: row.benchmark.beleid.afleiderbodem };
      };
      return { een: proef(1), twee: proef(2) };
    });
    ok('met een propagatiestap hangt het antwoord niet van het voorwerp af',
      Math.abs(r.een.J) < 0.05 && r.een.kleur < 0.05 && r.een.kan === false,
      `J ${pc(r.een.J)}, kleurafhankelijkheid ${r.een.kleur.toFixed(3)} tegen ruisbodem ${r.een.bodem.toFixed(3)}`);
    ok('en het resultaatbestand zegt dat zelf, in plaats van een nul te tonen',
      r.een.kan === false && r.een.prop === 1);
    ok('met twee propagatiestappen leert hetzelfde net de taak wel',
      r.twee.J > 0.8 && r.twee.kan === true && r.twee.kleur > 0.5,
      `J ${pc(r.twee.J)}, kleurafhankelijkheid ${r.twee.kleur.toFixed(2)}`);
  }

  /* ---------- 7. de pagina valt niet om ---------- */
  {
    const voor = fouten.length;
    await p.selectOption('#taak', 'proeftuin');
    await p.evaluate(() => { document.getElementById('nep').value = 3; });
    await p.click('#btnstart');
    await p.waitForTimeout(2500);
    await p.click('#btnstop').catch(() => {});
    await p.waitForTimeout(300);
    const beeld = await p.evaluate(() => {
      const c = document.getElementById('worldcvs');
      const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let anders = 0;
      for (let i = 0; i < g.length; i += 4) if (g[i] !== 15 || g[i + 1] !== 17 || g[i + 2] !== 20) anders++;
      return { anders, tot: g.length / 4, status: document.getElementById('s-dist').textContent };
    });
    ok('spel 3 kiezen en starten geeft geen paginafout', fouten.length === voor, fouten.slice(voor).join(' | '));
    ok('er wordt werkelijk iets getekend', beeld.anders > 0.02 * beeld.tot,
      `${(100 * beeld.anders / beeld.tot).toFixed(1)}% van het canvas, statusbalk "${beeld.status}"`);
  }

  console.log(fout ? `\n${fout} controle(s) FOUT` : '\nalles groen');
  if (fouten.length) console.log('paginafouten:', fouten.join(' | '));
  await b.close();
  process.exit(fout || fouten.length ? 1 : 0);
})();
