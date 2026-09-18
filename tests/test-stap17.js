/* De test die bij stap 17 hoort — het seinhuis.

   Wat deze test moet bewijzen, in volgorde van belangrijkheid:

   1. SPEL 1 IS ONVERANDERD. Niet "waarschijnlijk" maar aantoonbaar: de ang-conditie van
      stap 13 moet met hetzelfde zaad bit voor bit hetzelfde leven geven. Er is een hele
      taak bij gekomen en dat mag aan de oude metingen niets veranderen.
   2. DE SCORE HEEFT EEN SCHAAL. Een perfecte speler haalt 100 %, een geloot beleid haalt
      de voorspelde toevalsbodem van 6,25 %, en een speler die alle vier de handels
      vasthoudt haalt 0 %. Zonder die drie ijkpunten is elk getal dat dit spel oplevert
      een getal zonder betekenis — en de derde staat erbij omdat hij de val is waar de
      scoreregel voor gemaakt is.
   3. ELKE REGEL WORDT ECHT GESCOORD, en de dienst bevat waar zij om vraagt: eisen én
      afleiders, in ongeveer gelijke aantallen, met de juiste handel per regel.
   4. DE REGELS KLOPPEN MET HUN OMSCHRIJVING. Niet aangenomen maar nagerekend: per regel
      wordt uit de gegenereerde dienst teruggerekend of de eisen staan waar de regel zegt
      dat ze horen te staan.
   5. HET AANTAL ACTIEVE REGELS DOET WAT HET ZEGT, want stap 19 zet die knop tijdens één
      leven omhoog.
   6. DE AFLEIDERS ZIJN AFLEIDERS: de zeven ruiskanalen voorspellen niets.

   Draaien: tests\draai.cmd test-stap17.js s17-test-log.txt                             */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const OUT = path.resolve('experimenten');
let fout = 0;
const ok = (naam, goed, uitleg) => {
  console.log(`${goed ? 'OK  ' : 'FOUT'}  ${naam}${uitleg ? '   ' + uitleg : ''}`);
  if (!goed) fout++;
};
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1. spel 1 is onveranderd ---------- */
  {
    const { FASEN, MEET_SEED0 } = require('./stap13-condities');
    const { STAGVENSTER } = require('./stap16-condities');
    const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
    const MEETPUNT = { benchN: 200, benchReps: 1, memN: 50, memBlind: 20, memH: 40 };
    let vergeleken = 0, gelijkAan = 0;
    for (const zaad of [MEET_SEED0]) {
      const pad = path.join(OUT, 'runs', `s13-ang_z${zaad}.json`);
      if (!fs.existsSync(pad)) continue;
      const oud = JSON.parse(fs.readFileSync(pad, 'utf8'));
      const nieuw = await p.evaluate(([zaad, fasen, meet, totaal, stag]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = totaal; cfg.evalOn = false;
        cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 1;
        cfg.memOn = true; cfg.memN = 100;
        cfg = W.cfgOverride(cfg, { lr: 0.008, stagVenster: stag });
        return W.runLeven(cfg, zaad, fasen, 's17-controle', meet);
      }, [zaad, FASEN, MEETPUNT, TOTAAL, STAGVENSTER]);
      vergeleken++;
      const h = gelijk(oud.historie, nieuw.historie), n = gelijk(oud.netwerk, nieuw.netwerk);
      if (h && n) gelijkAan++; else console.log(`     zaad ${zaad}: historie ${h}, netwerk ${n}`);
    }
    ok('spel 1 geeft bit voor bit het leven van stap 13 terug',
      vergeleken > 0 && vergeleken === gelijkAan, `${gelijkAan}/${vergeleken} levens identiek`);
    ok('en een run van spel 1 krijgt geen seinhuis-veld',
      await p.evaluate(() => {
        const W = window.__brain;
        let cfg = W.cfgOverride(W.readCfg(), { lr: 0.008 });
        cfg.nEpisodes = 40; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
        return W.runLeven(cfg, 1000, [{ naam: 'x', pogingen: 40, ov: {} }], 's17-x', {}).seinhuis === null;
      }));
  }

  /* ---------- 2. de score heeft een schaal ---------- */
  const ijk = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis' });
    S.cfg = cfg;
    const diensten = W.seinBenchDiensten(100, cfg);
    /* Drie gescripte spelers, alle drie door dezelfde scorefunctie als de benchmark. */
    const speel = kies => {
      let eis = 0, goed = 0, stil = 0, loos = 0;
      const perRegel = new Array(W.SEIN_REGELS).fill(0).map(() => ({ eis: 0, goed: 0 }));
      for (const d of diensten) for (let t = 0; t < d.T; t++) {
        const P = kies(d, t);
        const s = W.seinScoreTik(d, t, P);
        if (s.regel > 0) { eis++; perRegel[s.regel - 1].eis++; if (s.goed) { goed++; perRegel[s.regel - 1].goed++; } }
        else { stil++; if (s.ingedrukt > 0) loos++; }
      }
      return { eis, goed, pct: eis ? goed / eis : null, stil, loos,
        loosAlarm: stil ? loos / stil : null, perRegel };
    };
    /* de perfecte speler leest de eis van de dienst af — hij is het plafond, niet een agent */
    const perfect = speel((d, t) => {
      const P = [0, 0, 0, 0];
      if (d.eisRegel[t] > 0) P[d.eisHandel[t]] = 1;
      return P;
    });
    /* een geloot beleid met p = 0,5 per handel, met een eigen generator */
    let z = 123456789;
    const munt = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return (z / 0x7fffffff) < 0.5 ? 1 : 0; };
    const geloot = speel(() => [munt(), munt(), munt(), munt()]);
    /* en de baksteen: alles vasthouden */
    const baksteen = speel(() => [1, 1, 1, 1]);
    /* niets doen */
    const lui = speel(() => [0, 0, 0, 0]);
    return { perfect, geloot, baksteen, lui, diensten: diensten.length,
      regels: W.SEIN_KORT, tikken: diensten[0].T };
  });

  ok('een perfecte speler haalt 100 % op elke regel',
    ijk.perfect.pct === 1 && ijk.perfect.perRegel.every(r => r.eis === 0 || r.goed === r.eis),
    `${(100 * ijk.perfect.pct).toFixed(1)} %, ${ijk.perfect.eis} eisen over ${ijk.diensten} diensten`);
  ok('en hij geeft geen enkel loos alarm', ijk.perfect.loosAlarm === 0);
  ok('een geloot beleid landt op de voorspelde toevalsbodem van 6,25 %',
    Math.abs(ijk.geloot.pct - 0.0625) < 0.02,
    `gemeten ${(100 * ijk.geloot.pct).toFixed(2)} %, voorspeld 6.25 %`);
  ok('alle handels vasthouden levert 0 % op — anders is de scoreregel kapot',
    ijk.baksteen.pct === 0, `${(100 * ijk.baksteen.pct).toFixed(1)} %`);
  ok('en het levert op elke stille tik een loos alarm op', ijk.baksteen.loosAlarm === 1);
  ok('niets doen levert ook 0 % op', ijk.lui.pct === 0);
  ok('maar niets doen geeft wél nul loze alarmen',
    ijk.lui.loosAlarm === 0, 'de twee manieren om te falen zijn te onderscheiden');

  /* ---------- 3. elke regel wordt echt gescoord ---------- */
  ok('elke regel komt in de dienstenset voor',
    ijk.perfect.perRegel.every(r => r.eis > 0),
    ijk.perfect.perRegel.map((r, i) => `${ijk.regels[i]}:${r.eis}`).join(' '));
  {
    const n = ijk.perfect.perRegel.map(r => r.eis);
    const scheef = Math.max(...n) / Math.min(...n);
    ok('en de regels komen ongeveer even vaak voor', scheef < 2.5,
      `verhouding drukste/rustigste regel ${scheef.toFixed(2)}`);
  }

  /* ---------- 4. de regels kloppen met hun omschrijving ---------- */
  const regelcheck = await p.evaluate(() => {
    const W = window.__brain;
    const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis' });
    W.S.cfg = cfg;
    const diensten = W.seinBenchDiensten(60, cfg);
    const uit = { r1: { goed: 0, mis: 0 }, r2: { goed: 0, mis: 0 }, r3: { goed: 0, mis: 0 },
      r4: { goed: 0, mis: 0 }, r5: { goed: 0, mis: 0 }, r6: { goed: 0, mis: 0 },
      afleiderR1: 0, afleiderR2: 0, handels: {} };
    for (const d of diensten) {
      let tel6 = 0;
      for (let t = 0; t < d.T; t++) {
        const r = d.eisRegel[t], h = d.eisHandel[t];
        if (r > 0) uit.handels[r + '->' + h] = (uit.handels[r + '->' + h] || 0) + 1;
        if (r === 1) (d.lamp[t] === 0 && d.wissel[t] === 1 ? uit.r1.goed++ : uit.r1.mis++);
        if (r === 2) (d.lamp[t] === 1 && d.wissel[t] === 0 ? uit.r2.goed++ : uit.r2.mis++);
        /* R3 en R4 worden hier onafhankelijk nagerekend volgens de regel zoals zij
           geformuleerd is: een vlag geldt vanaf de vórige vraag tot deze. Terugkijken
           over een vast venster zou een andere regel narekenen dan de taak stelt — en dat
           deed de eerste versie van deze test, met tientallen "fouten" die geen fouten
           waren maar een verschil van definitie. */
        if (r === 3 || r === 4) {
          const vraagLamp = r === 3 ? 3 : 5, vlagLamp = r === 3 ? 2 : 4;
          const metVlag = r === 3 ? 0 : 2, zonder = r === 3 ? 1 : 3;
          let vlag = false;
          for (let k = t - 1; k >= 0; k--) {
            if (d.lamp[k] === vraagLamp) break;
            if (d.lamp[k] === vlagLamp) { vlag = true; break; }
          }
          const verwacht = vlag ? metVlag : zonder;
          const doel = r === 3 ? uit.r3 : uit.r4;
          (d.lamp[t] === vraagLamp && h === verwacht) ? doel.goed++ : doel.mis++;
        }
        if (r === 6) {
          let paar = false;
          for (let k = 1; k <= 3 && t - k >= 0; k++) if (d.lamp[t - k] === 7) paar = true;
          (d.lamp[t] === 7 && paar && h === 3) ? uit.r6.goed++ : uit.r6.mis++;
        }
        /* R5 telt over de dienst: elke derde lamp 6 */
        if (d.lamp[t] === 6) { tel6++; const moet = (tel6 % 3 === 0);
          if (moet) (r === 5 && h === 2 ? uit.r5.goed++ : uit.r5.mis++);
          else if (r === 5) uit.r5.mis++; }
        /* afleiders: lamp 0 met wissel dicht en lamp 1 met wissel open eisen niets */
        if (d.lamp[t] === 0 && d.wissel[t] === 0 && r === 0) uit.afleiderR1++;
        if (d.lamp[t] === 1 && d.wissel[t] === 1 && r === 0) uit.afleiderR2++;
      }
    }
    return uit;
  });
  for (const r of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) {
    const x = regelcheck[r];
    ok(`${r.toUpperCase()} staat waar de regel zegt dat hij hoort te staan`,
      x.goed > 0 && x.mis === 0, `${x.goed} kloppen, ${x.mis} niet`);
  }
  ok('R1 en R2 hebben allebei afleiders die niets eisen',
    regelcheck.afleiderR1 > 0 && regelcheck.afleiderR2 > 0,
    `lamp 0 met wissel dicht: ${regelcheck.afleiderR1}, lamp 1 met wissel open: ${regelcheck.afleiderR2}`);
  /* Een regel waarvan één antwoord overheerst is voor een deel op te lossen door te
     gokken op de meerderheid, en meet dan niet meer wat hij belooft. Daarom hoort de
     verdeling van de twee antwoorden bij R3 en R4 ergens in het midden te liggen. */
  for (const [regel, a, b] of [['R3', '3->0', '3->1'], ['R4', '4->2', '4->3']]) {
    const na = regelcheck.handels[a] || 0, nb = regelcheck.handels[b] || 0;
    const deel = (na + nb) ? na / (na + nb) : 0;
    ok(`${regel} is niet op te lossen door altijd hetzelfde antwoord te geven`,
      deel > 0.35 && deel < 0.65,
      `${(100 * deel).toFixed(0)} % / ${(100 * (1 - deel)).toFixed(0)} % (${na} tegen ${nb})`);
  }
  ok('elke handel wordt door minstens twee regels gebruikt',
    (() => {
      const perHandel = {};
      for (const k in regelcheck.handels) { const h = k.split('->')[1];
        (perHandel[h] = perHandel[h] || new Set()).add(k.split('->')[0]); }
      return Object.values(perHandel).every(s => s.size >= 2) && Object.keys(perHandel).length === 4;
    })(), JSON.stringify(regelcheck.handels));

  /* ---------- 5. het aantal actieve regels doet wat het zegt ---------- */
  {
    const perAantal = await p.evaluate(() => {
      const W = window.__brain;
      const uit = [];
      for (let nR = 1; nR <= W.SEIN_REGELS; nR++) {
        const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis', seinRegels: nR });
        W.S.cfg = cfg;
        W.S.seinBench = null;                    /* de set hoort per stand opnieuw gemaakt te worden */
        const d = W.seinBenchDiensten(30, cfg);
        const gezien = new Set();
        for (const x of d) for (let t = 0; t < x.T; t++) if (x.eisRegel[t] > 0) gezien.add(x.eisRegel[t]);
        uit.push({ nR, regels: [...gezien].sort((a, b) => a - b) });
      }
      return uit;
    });
    ok('bij n actieve regels komen er precies n regels voor',
      perAantal.every(x => x.regels.length === x.nR && x.regels.every(r => r <= x.nR)),
      perAantal.map(x => `${x.nR}:[${x.regels}]`).join(' '));
  }

  /* ---------- 6. de afleiders leiden af ---------- */
  {
    const ruis = await p.evaluate(() => {
      const W = window.__brain;
      const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis' });
      W.S.cfg = cfg; W.S.seinBench = null;
      const d = W.seinBenchDiensten(60, cfg);
      const inp = new Float32Array(16);
      /* voor elk van de zeven afleiders: het gemiddelde op eis-tikken tegen dat op stille
         tikken. Zijn die gelijk, dan voorspelt het kanaal niets. */
      const som = new Float64Array(7), somStil = new Float64Array(7);
      let nE = 0, nS = 0;
      for (const x of d) for (let t = 0; t < x.T; t++) {
        W.seinWaarnemen(x, t, inp);
        const eis = x.eisRegel[t] > 0;
        for (let i = 0; i < 7; i++) { if (eis) som[i] += inp[9 + i]; else somStil[i] += inp[9 + i]; }
        if (eis) nE++; else nS++;
      }
      return { verschil: Array.from(som, (v, i) => v / nE - somStil[i] / nS), nE, nS };
    });
    ok('de zeven afleiderkanalen voorspellen geen enkele eis',
      ruis.verschil.every(v => Math.abs(v) < 0.05),
      'grootste verschil ' + Math.max(...ruis.verschil.map(Math.abs)).toFixed(3) +
      ` over ${ruis.nE} eis- en ${ruis.nS} stille tikken`);
  }

  /* ---------- en een echte agent draait erop ---------- */
  {
    const leven = await p.evaluate(() => {
      const W = window.__brain;
      let cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis', lr: 0.008, worldEvery: 1 });
      cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 40; cfg.benchReps = 1;
      cfg.memOn = false;
      const row = W.runLeven(cfg, 1000, [{ naam: 'x', pogingen: 60, ov: {} }], 's17-agent', {});
      return { bench: row.benchmark.beleid, seinhuis: row.seinhuis,
        historie: row.historie.length, struct: row.structuur.verbindingen };
    });
    ok('een echte agent speelt het spel en levert een benchmark op',
      /* sinds stap 18 is de score Youdens J per regel, en die loopt van -1 tot 1 */
      leven.bench && isFinite(leven.bench.pct) && leven.bench.pct >= -1 && leven.bench.pct <= 1,
      `score ${(100 * leven.bench.pct).toFixed(1)} %`);
    ok('met een score per regel erin',
      leven.bench.perRegel && Object.keys(leven.bench.perRegel).length === 6,
      Object.entries(leven.bench.perRegel || {})
        .map(([k, v]) => `${k} ${v.pct === null ? '–' : (100 * v.pct).toFixed(0) + '%'}`).join('  '));
    ok('en het seinhuisblok staat in het resultaat',
      /* sinds stap 18: de bodem van een geloot beleid met vier losse handels, in J */
      leven.seinhuis && leven.seinhuis.toevalsbodem === -0.875);
    ok('de agent doet het niet beter dan de perfecte speler',
      leven.bench.pct <= 1);
  }

  if (fouten.length) { console.error('paginafouten:\n' + fouten.join('\n')); fout++; }
  console.log(fout ? `\n${fout} controle(s) MISLUKT` : '\nalle controles groen');
  process.exitCode = fout ? 1 : 0;
  await b.close();
})();
