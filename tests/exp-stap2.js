/* Stap 2 — de voor/na-meting van het eligibility-herstel.
   Twee condities, dezelfde zaden, verder identieke instellingen. Wat er uit komt
   komt eruit; ook "geen verschil" is een resultaat.                              */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const OUT = path.resolve('experimenten');
const NSEEDS = 12, NEP = 500, SEED0 = 1000;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
  const hdr = await p.evaluate(() => window.__brain.CSV_COLS.join(','));
  const csvPad = path.join(OUT, 'runs.csv');
  let lines = fs.existsSync(csvPad) ? fs.readFileSync(csvPad, 'utf8').trim().split('\n') : [hdr];
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina');

  const per = { 'trace-oud': [], 'trace-nieuw': [] };
  for (const [naam, oud] of [['trace-oud', true], ['trace-nieuw', false]]) {
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t = Date.now();
      const r = await p.evaluate(([zaad, nep, oud, naam]) => {
        const W = window.__brain;
        const cfg = W.readCfg(); cfg.nEpisodes = nep; cfg.evalOn = true; cfg.traceOud = oud;
        const row = W.runOne(cfg, zaad, naam);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, NEP, oud, naam]);
      lines.push(r.csv);
      fs.writeFileSync(path.join(OUT, 'runs', `${naam}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
      const res = r.json.resultaat, st = r.json.structuur;
      per[naam].push({ zaad, succes20: res.succes20, toets: res.toetsPct, succes: res.succesPct,
        stappen: res.gemStappenBijSucces, actief: st.actieveVerbindingen, reflex: st.reflexbogen,
        pad: st.kortstePad, neuronen: r.json.config.neuronenNu });
      console.log(`${naam.padEnd(12)} zaad ${zaad}: laatste20 ${(res.succes20 * 100).toFixed(0)}%  ` +
        `toets ${(res.toetsPct * 100).toFixed(0)}%  actief ${st.actieveVerbindingen}  reflex ${st.reflexbogen}  ` +
        `(${((Date.now() - t) / 1000).toFixed(0)}s)`);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    }
  }

  /* --- statistiek: gepaard per zaad, plus Mann-Whitney U --- */
  const mci = xs => {
    const n = xs.length, m = xs.reduce((a, c) => a + c, 0) / n;
    const sd = n > 1 ? Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / (n - 1)) : 0;
    return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
  };
  function mannWhitney(a, b) {
    const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1])).sort((x, y) => x[0] - y[0]);
    const rank = new Array(all.length);
    for (let i = 0; i < all.length;) {
      let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
      const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) rank[k] = r; i = j + 1;
    }
    let Ra = 0; all.forEach((e, i) => { if (e[1] === 0) Ra += rank[i]; });
    const na = a.length, nb = b.length;
    const Ua = Ra - na * (na + 1) / 2, Ub = na * nb - Ua, U = Math.min(Ua, Ub);
    const mu = na * nb / 2, sg = Math.sqrt(na * nb * (na + nb + 1) / 12);
    const z = (U - mu + 0.5) / sg;
    const pnorm = x => 0.5 * (1 + erf(x / Math.SQRT2));
    function erf(x) { const s = Math.sign(x); x = Math.abs(x);
      const t = 1 / (1 + 0.3275911 * x);
      const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return s * y; }
    return { U, z, p: 2 * pnorm(-Math.abs(z)) };
  }

  const samenvatting = { uitgevoerd: new Date().toISOString(), pogingenPerRun: NEP, zaden: NSEEDS,
    beschrijving: 'Eligibility-trace: presynaptische activatie uit de momentopname B.pre (nieuw) ' +
      'tegenover de postsynaptische toestand B.act (oud). Zelfde breinzaden, zelfde wereldzaad, ' +
      'verder identieke instellingen.', maten: {}, perZaad: per };
  for (const maat of ['succes20', 'toets', 'succes', 'actief', 'reflex']) {
    const A = per['trace-oud'].map(r => r[maat]).filter(v => v !== null && isFinite(v));
    const Bv = per['trace-nieuw'].map(r => r[maat]).filter(v => v !== null && isFinite(v));
    const gepaard = per['trace-nieuw'].map((r, i) => r[maat] - per['trace-oud'][i][maat]).filter(v => isFinite(v));
    const st = mannWhitney(A, Bv);
    samenvatting.maten[maat] = { oud: mci(A), nieuw: mci(Bv), verschilGepaard: mci(gepaard), mannWhitney: st,
      oordeel: st.p < 0.05 ? 'verschil is er echt' : 'verschil valt binnen de ruis' };
    const f = o => `${o.m.toFixed(3)} ± ${o.ci.toFixed(3)} (sd ${o.sd.toFixed(3)})`;
    console.log(`\n${maat}\n  oud   ${f(mci(A))}\n  nieuw ${f(mci(Bv))}\n  verschil (gepaard) ${f(mci(gepaard))}` +
      `\n  Mann-Whitney U=${st.U} z=${st.z.toFixed(2)} p=${st.p.toFixed(4)} → ${samenvatting.maten[maat].oordeel}`);
  }
  fs.writeFileSync(path.join(OUT, 'trace-voor-na.json'), JSON.stringify(samenvatting, null, 2));
  await b.close();
})();
