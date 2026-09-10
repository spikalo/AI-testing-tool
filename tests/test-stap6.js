/* Stap 6 — bewijzen dat de vergelijking met backpropagation eerlijk is.

   De claim van dit werkpakket is smal en precies: tussen de perturbatieconditie en
   de backpropconditie verschilt één ding, en dat is de schátter. Alles eromheen —
   het spoor met dezelfde lambda, de lopende basislijn, de begrensde stap, de
   vervaging per poging, de Bernoulli-knoppen, de beloningen, de werelden en de
   benchmark — is identiek. Zolang dat niet aantoonbaar is, meet de tabel van stap 6
   iets anders dan wat er boven staat.

   Wat hier wordt nagemeten:
     1  de exacte gradiënt is écht de gradiënt (eindige differenties op log pi),
        voor een voorwaarts net, een dieper net en een net met terugkoppeling;
     2  de terugkoppelende gewichten krijgen de juiste presynaptische waarde —
        dat is een aparte val, en test 1 vangt hem alleen als het net recurrent is;
     3  de rekenkostenteller klopt op de eenheid nauwkeurig met de formule;
     4  perturbatie en backprop verschillen in niets anders dan de schatter;
     5  twee runs met hetzelfde zaad zijn bit voor bit gelijk;
     6  en het belangrijkste: ANG zelf is door dit alles heen niet veranderd —
        de conditie ang-vast met zaad 1000 levert nog exact de getallen uit stap 5.
*/
const { chromium } = require('playwright');
const path = require('path');

let ok = 0, fout = 0;
function check(naam, geslaagd, detail) {
  if (geslaagd) { ok++; console.log(`  ok   ${naam}${detail ? '   ' + detail : ''}`); }
  else { fout++; console.log(`  FOUT ${naam}${detail ? '   ' + detail : ''}`); }
}

/* De drie netten die in stap 6 tegenover ANG komen te staan. De propagatiediepte
   is per net gelijk aan het aantal bogen van invoer naar knop: dan rekent het net
   zijn uitvoer binnen één spelstap uit, zoals een gewoon voorwaarts net dat doet,
   en is er geen reactielatentie die de vergelijking vertroebelt. */
const NETTEN = [
  { naam: 'mlp-16', ov: { layerSizes: [16], prop: 2 } },
  { naam: 'mlp-32-32', ov: { layerSizes: [32, 32], prop: 3 } },
  { naam: 'elman-16', ov: { layerSizes: [16], prop: 2, recurrent: true } }
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const pagefouten = [];
  p.on('pageerror', e => pagefouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1 + 2: is de exacte gradiënt de gradiënt? ----------
     Eén spelstap wordt bevroren: dezelfde begintoestand, dezelfde sensorwaarden,
     dezelfde geloten actie. Het spoor met lambda = 0 is dan per gewicht precies
     d log pi / d w. Dat vergelijken we met (log pi(w+eps) - log pi(w-eps)) / 2 eps,
     berekend door de voorwaartse pas letterlijk over te doen. Alles staat in
     Float32, dus de eindige differentie heeft zelf ruis; daarom kijken we naar de
     cosinus over alle gewichten en naar de relatieve fout op de zwaarste termen,
     niet naar exacte gelijkheid. */
  console.log('\n1+2. de exacte gradiënt tegen eindige differenties');
  for (const net of NETTEN) {
    const r = await p.evaluate(([ov]) => {
      const W = window.__brain, K = W.K;
      let cfg = W.readCfg();
      cfg = W.cfgOverride(cfg, Object.assign({
        layered: true, gradExact: true, structOn: false, growOn: false, retypeOn: false
      }, ov));
      const B = W.createLayered(cfg, 4242);
      W.S.cfg = cfg; W.S.B = B;
      W.resetBrainState(B);
      const rnd = W.mulberry32(99);
      const inp = new Float32Array(16);
      for (let i = 0; i < 16; i++) inp[i] = rnd();
      const expl = 0.30, tp = W.tempOf(expl);
      /* een paar tikken vooraf, zodat de toestand — en bij een recurrent net de
         teruggekoppelde toestand — niet toevallig nul is */
      for (let t = 0; t < 6; t++) W.brainStep(B, inp, cfg, expl, rnd);

      const beginToestand = Float32Array.from(B.act);
      W.brainStep(B, inp, cfg, expl, rnd);
      const acties = Array.from(B.press);
      W.updateTracesExact(B, 0);
      const analytisch = Float64Array.from(B.cE);

      const logpi = () => {
        B.act.set(beginToestand);
        W.propagate(B, inp, cfg, 0, tp, B.act, rnd);
        let L = 0;
        for (let j = K.OUT0; j < K.HID0; j++) {
          const pr = Math.min(1 - 1e-9, Math.max(1e-9, B.act[j]));
          L += acties[j - K.OUT0] ? Math.log(pr) : Math.log(1 - pr);
        }
        return L;
      };
      const eps = 2e-3;
      const numeriek = new Float64Array(B.nc);
      for (let c = 0; c < B.nc; c++) {
        const w0 = B.cW[c];
        B.cW[c] = w0 + eps; const a1 = logpi();
        B.cW[c] = w0 - eps; const a2 = logpi();
        B.cW[c] = w0;
        numeriek[c] = (a1 - a2) / (2 * eps);
      }
      let sab = 0, saa = 0, sbb = 0;
      for (let c = 0; c < B.nc; c++) { sab += analytisch[c] * numeriek[c]; saa += analytisch[c] ** 2; sbb += numeriek[c] ** 2; }
      const cos = sab / (Math.sqrt(saa * sbb) || 1);
      /* relatieve fout op de vijftig zwaarste termen: daar telt een afwijking */
      const idx = Array.from({ length: B.nc }, (_, c) => c)
        .sort((x, y) => Math.abs(analytisch[y]) - Math.abs(analytisch[x])).slice(0, 50);
      let maxRel = 0;
      for (const c of idx) maxRel = Math.max(maxRel, Math.abs(analytisch[c] - numeriek[c]) / (Math.abs(numeriek[c]) || 1e-12));
      /* hoeveel van de massa zit in de terugkoppeling? zo weten we dat test 2 iets
         te controleren had in plaats van over nul te lopen */
      let recMassa = 0, totMassa = 0;
      for (let c = 0; c < B.nc; c++) { const m = Math.abs(analytisch[c]); totMassa += m; if (B.cRec[c]) recMassa += m; }
      return { cos, maxRel, nc: B.nc, ff: B.ffCount, rec: B.nc - B.ffCount, recDeel: totMassa ? recMassa / totMassa : 0 };
    }, [net.ov]);
    check(`${net.naam}: cosinus met de numerieke gradiënt`, r.cos > 0.9999,
      `cos = ${r.cos.toFixed(6)}, ${r.nc} gewichten (${r.ff} voorwaarts, ${r.rec} terugkoppelend)`);
    check(`${net.naam}: relatieve fout op de zwaarste termen`, r.maxRel < 0.02,
      `max = ${(100 * r.maxRel).toFixed(2)} %`);
    if (net.ov.recurrent) {
      check(`${net.naam}: de terugkoppeling draagt echt bij`, r.recDeel > 0.05,
        `${(100 * r.recDeel).toFixed(1)} % van de gradiëntmassa zit in de terugkoppelende gewichten`);
    } else {
      check(`${net.naam}: geen terugkoppelende gewichten`, r.rec === 0);
    }
  }

  /* ---------- 3: klopt de rekenkostenteller? ----------
     De teller hoogt per lus op met het aantal verbindingen in plaats van per
     verbinding. Dat is alleen goedkoop als het ook exact is, en dat is precies wat
     hier wordt nagerekend: per lerende spelstap één of twee propagaties (de exacte
     gradiënt heeft geen ruispas nodig), plus bij backprop de terugwaartse pas over
     de voorwaartse verbindingen, plus het spoor, plus de gewichtsupdate; en per
     poging één keer vervagen. */
  console.log('\n3. de rekenkostenteller tegen de formule');
  for (const exact of [false, true]) {
    const r = await p.evaluate(([exact]) => {
      const W = window.__brain;
      let cfg = W.readCfg();
      cfg = W.cfgOverride(cfg, {
        layered: true, layerSizes: [16], prop: 2, gradExact: exact,
        structOn: false, growOn: false, retypeOn: false,
        nEpisodes: 30, evalOn: false, benchOn: false
      });
      const row = W.runOne(cfg, 1000, 'teller');
      const S = W.S, B = S.B, rk = row.resultaat.rekenkosten;
      const verwacht = S.stapLeer * ((exact ? 1 : 2) * cfg.prop * B.nc + (exact ? B.ffCount : 0) + 2 * B.nc)
        + S.ep * B.nc;
      return {
        gemeten: S.kbLeer, verwacht, nc: B.nc, ff: B.ffCount,
        stappen: S.stapLeer, pogingen: S.ep,
        perStap: rk.kantenBezoekenLeerStap, kbInf: S.kbInf, stapInf: S.stapInf
      };
    }, [exact]);
    check(`${exact ? 'backprop' : 'perturbatie'}: kanten-bezoeken tijdens leren`,
      r.gemeten === r.verwacht,
      `${r.gemeten} gemeten, ${r.verwacht} verwacht (${r.stappen} spelstappen, ${r.nc} verbindingen)`);
    check(`${exact ? 'backprop' : 'perturbatie'}: geen inferentie geteld zonder toets`,
      r.kbInf === 0 && r.stapInf === 0);
  }
  {
    /* en de twee kostenposten blijven gescheiden: mét toetsen loopt de
       inferentieteller wél op, en de leerteller precies even hard als zonder */
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const bouw = evalOn => W.cfgOverride(W.readCfg(), {
        layered: true, layerSizes: [16], prop: 2, gradExact: true,
        structOn: false, growOn: false, retypeOn: false,
        nEpisodes: 40, evalOn, benchOn: false
      });
      W.runOne(bouw(false), 1000, 'zonder'); const a = { leer: W.S.kbLeer, inf: W.S.kbInf, st: W.S.stapLeer };
      W.runOne(bouw(true), 1000, 'met'); const b = { leer: W.S.kbLeer, inf: W.S.kbInf, st: W.S.stapLeer };
      return { a, b };
    });
    check('toetsen komen op de inferentieteller, niet op de leerteller',
      r.a.leer === r.b.leer && r.a.st === r.b.st && r.a.inf === 0 && r.b.inf > 0,
      `leren ${r.b.leer} in beide gevallen, inferentie 0 tegen ${r.b.inf}`);
  }

  /* ---------- 4: verschilt er werkelijk maar één ding? ---------- */
  console.log('\n4. perturbatie tegen backprop: alleen de schatter verschilt');
  {
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const bouw = g => W.cfgOverride(W.readCfg(), {
        layered: true, layerSizes: [16], prop: 2, gradExact: g,
        structOn: false, growOn: false, retypeOn: false, nEpisodes: 20, evalOn: false, benchOn: false
      });
      const cA = bouw(false), cB = bouw(true);
      const anders = Object.keys(cA).filter(k => JSON.stringify(cA[k]) !== JSON.stringify(cB[k]));
      /* en het startbrein zelf moet bit voor bit hetzelfde zijn: dezelfde
         bedrading, dezelfde startgewichten, dezelfde bias */
      const A = W.createLayered(cA, 1000), B = W.createLayered(cB, 1000);
      let gelijk = A.nc === B.nc && A.n === B.n;
      for (let c = 0; c < A.nc && gelijk; c++)
        gelijk = A.cFrom[c] === B.cFrom[c] && A.cTo[c] === B.cTo[c] && A.cW[c] === B.cW[c];
      for (let i = 0; i < A.n && gelijk; i++) gelijk = A.bias[i] === B.bias[i];
      return { anders, gelijk };
    });
    check('precies één instelling verschilt', r.anders.length === 1 && r.anders[0] === 'gradExact',
      `verschillend: ${r.anders.join(', ') || '(niets)'}`);
    check('het startbrein is bit voor bit hetzelfde', r.gelijk);
  }

  /* ---------- 5: reproduceerbaar ---------- */
  console.log('\n5. reproduceerbaarheid');
  {
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const draai = () => {
        const cfg = W.cfgOverride(W.readCfg(), {
          layered: true, layerSizes: [16], prop: 2, gradExact: true, recurrent: true,
          structOn: false, growOn: false, retypeOn: false, nEpisodes: 60, evalOn: true, benchOn: false
        });
        const row = W.runOne(cfg, 1007, 'herhaal');
        return {
          s20: row.resultaat.succes20, toets: row.resultaat.toetsPct,
          w: Array.from(W.S.B.cW), kb: W.S.kbLeer
        };
      };
      const a = draai(), b = draai();
      let gelijk = a.s20 === b.s20 && a.toets === b.toets && a.kb === b.kb;
      for (let i = 0; i < a.w.length && gelijk; i++) gelijk = a.w[i] === b.w[i];
      return { gelijk, s20: a.s20, kb: a.kb };
    });
    check('twee runs met hetzelfde zaad zijn bit voor bit gelijk', r.gelijk,
      `laatste 20 = ${(100 * r.s20).toFixed(0)} %, ${r.kb} kanten-bezoeken`);
  }

  /* ---------- 6: is ANG zelf onveranderd? ----------
     Dit is de belangrijkste controle van het hele pakket. Er is deze sessie aan
     brainStep, aan het spoor en aan de spelstap gesleuteld, en al die code draagt
     ook de bestaande metingen van stap 2 tot en met 5. Als de conditie ang-vast met
     zaad 1000 niet meer exact dezelfde getallen geeft als in runs.csv staan, dan is
     de hele reeks van vorige week ongeldig geworden en moet dat blijken vóórdat er
     een nieuwe tabel op gebouwd wordt. */
  console.log('\n6. regressie: ANG is niet veranderd');
  {
    const REF = { succesPct: 0.686, succes20: 0.95, toetsPct: 0.8, toetsStreng: 0.7, verbindingen: 2639, actief: 1281 };
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const cfg = W.cfgOverride(W.readCfg(), {
        structOn: false, growOn: false, retypeOn: false,
        nEpisodes: 500, evalOn: true, benchOn: false
      });
      const row = W.runOne(cfg, 1000, 'regressie-ang-vast');
      return {
        succesPct: row.resultaat.succesPct, succes20: row.resultaat.succes20,
        toetsPct: row.resultaat.toetsPct, toetsStreng: row.resultaat.toetsStreng,
        verbindingen: row.structuur.verbindingen, actief: row.structuur.actieveVerbindingen,
        rk: row.resultaat.rekenkosten
      };
    });
    for (const k of Object.keys(REF))
      check(`ang-vast z1000: ${k}`, Math.abs(r[k] - REF[k]) < 1e-9, `${r[k]} (stap 5: ${REF[k]})`);
    check('de rekenkosten worden ook voor ANG ingevuld',
      r.rk.kantenBezoekenLeerStap > 0 && r.rk.pogingenTot80 !== null,
      `${r.rk.kantenBezoekenLeerStap.toFixed(0)} kanten-bezoeken per lerende spelstap, ` +
      `80 % bereikt na ${r.rk.pogingenTot80} pogingen / ${r.rk.omgevingsstappenTot80} omgevingsstappen`);
  }

  if (pagefouten.length) { console.error('\npaginafouten:\n' + pagefouten.join('\n')); fout++; }
  console.log(`\n${ok} controles goed, ${fout} fout`);
  await b.close();
  process.exitCode = fout ? 1 : 0;
})();
