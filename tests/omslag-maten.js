/* De maten van de omslagproef, uit één leven.

   WAAROM DIT EEN APART BESTAND IS. Stap 16 draait dezelfde proef als stap 13 en moet
   dus dezelfde maten gebruiken, tot op de laatste regel. Ze overschrijven in de nieuwe
   loper zou betekenen dat twee bestanden hetzelfde moeten blijven zeggen — en dat is
   precies hoe een vergelijking stilletjes scheef gaat. De code hieronder is woordelijk
   die uit tests/exp-stap13.js; exp-stap13.js zelf blijft ongemoeid, omdat zijn
   uitvoer al vastligt en een herschikking daar niets aan mag veranderen. Dat de kopie
   klopt, wordt niet beweerd maar nagemeten: tests/test-stap16.js rekent met dit
   bestand de tabel van stap 13 opnieuw uit de opgeslagen runs en legt hem naast
   experimenten/omslag.json.                                                          */

function maakMaten({ TOTAAL, OMSLAG, PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER }) {
  return function maten(row) {
    const H = row.historie || [];
    const succ = new Array(TOTAAL).fill(null);
    for (const h of H) if (h.poging >= 0 && h.poging < TOTAAL) succ[h.poging] = h.succes20;
    const gem = (van, tot) => {
      const v = succ.slice(van, tot).filter(x => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const om1 = OMSLAG[0], g2 = OMSLAG[1];
    const plateau = gem(om1 - PLATEAU_VENSTER, om1);
    const drempel = plateau === null ? null : HERSTEL_DREMPEL * plateau;

    let hersteltijd = null;
    if (drempel !== null) for (let i = g2; i < TOTAAL; i++)
      if (succ[i] !== null && succ[i] >= drempel) { hersteltijd = i - g2; break; }

    const dip = OMSLAG.map(g => {
      const v = succ.slice(g, g + OMSLAG_VENSTER).filter(x => x !== null);
      return v.length ? Math.min(...v) : null;
    });

    const L = row.herstructureringen || [];
    const som = (van, tot) => L.filter(e => e.ep > van && e.ep <= tot)
      .reduce((a, e) => a + (e.pruned || 0) + (e.sprouted || 0) + (e.retyped || 0) + (e.grown || 0), 0);
    const churn = OMSLAG.map(g => ({
      omslag: g,
      voor: som(g - OMSLAG_VENSTER, g) / OMSLAG_VENSTER,
      na: som(g, g + OMSLAG_VENSTER) / OMSLAG_VENSTER
    }));

    const F = (row.leven && row.leven.fasen) || [];
    const opA = i => (F[i] && F[i].opTaakA) ? F[i].opTaakA.pct : null;
    const opEigen = i => (F[i] && F[i].opEigenTaak) ? F[i].opEigenTaak.pct : null;

    return {
      zaad: row.breinZaad,
      plateau, hersteltijd, gecensureerd: hersteltijd === null,
      dipNaB: dip[0], dipNaTerug: dip[1],
      aEind1: opA(0), aEind2: opA(1), aEind3: opA(2),
      bScore: opEigen(1),
      behoud: (opA(1) !== null && opA(0) !== null) ? opA(1) - opA(0) : null,
      terugwinst: (opA(2) !== null && opA(0) !== null) ? opA(2) - opA(0) : null,
      churnVoor1: churn[0].voor, churnNa1: churn[0].na,
      churnVoor2: churn[1].voor, churnNa2: churn[1].na,
      horizon1: F[0] ? F[0].geheugenhorizon : null,
      horizon2: F[1] ? F[1].geheugenhorizon : null,
      horizon3: F[2] ? F[2].geheugenhorizon : null,
      benchEind: row.benchmark ? row.benchmark.beleid.pct : null,
      tijdMs: row.resultaat ? row.resultaat.rekentijdMs : null,
      /* nieuw in stap 16, en null voor elk leven van vóór deze stap */
      ronden: L.length,
      rondenNa1: L.filter(e => e.ep > OMSLAG[0] && e.ep <= OMSLAG[0] + OMSLAG_VENSTER).length,
      rondenNa2: L.filter(e => e.ep > OMSLAG[1] && e.ep <= OMSLAG[1] + OMSLAG_VENSTER).length
    };
  };
}

/* De poortmaten: puur beschrijvend, en ze horen bij V1 — de controle op de ingreep.
   Gevraagd wordt of de poort ná een omslag vaker vuurt dan daarbuiten, per omslag
   apart, en hoeveel pogingen zij erover doet om aan te slaan. Eerst wordt op
   eindigheid en bereik getoetst en pas daarna op verschil: een meting moet eerst
   bewijzen dát er gemeten is (stap 13, fout 14). */
function poortMaten(row, OMSLAG, VENSTER) {
  const P = row.poort || [];
  const rijp = P.filter(r => r.rijp && r.d !== null && isFinite(r.d));
  const binnen = g => rijp.filter(r => r.poging > g && r.poging <= g + VENSTER);
  const buiten = rijp.filter(r => !OMSLAG.some(g => r.poging > g && r.poging <= g + VENSTER));
  const kans = a => a.length ? a.filter(r => r.signaalVuur).length / a.length : null;
  const eerste = g => {
    const v = binnen(g).find(r => r.signaalVuur);
    return v ? v.poging - g : null;
  };
  const dGem = a => a.length ? a.reduce((x, r) => x + r.d, 0) / a.length : null;
  return {
    pogingenMetD: P.filter(r => r.d !== null).length,
    pogingenRijp: rijp.length,
    alleDEindig: P.every(r => r.d === null || isFinite(r.d)),
    alleDNietNegatief: P.every(r => r.d === null || r.d >= 0),
    alleDrempelEindig: rijp.every(r => r.drempel === null || isFinite(r.drempel)),
    dBuiten: dGem(buiten), vuurBuiten: kans(buiten),
    dNa1: dGem(binnen(OMSLAG[0])), vuurNa1: kans(binnen(OMSLAG[0])), eersteNa1: eerste(OMSLAG[0]),
    dNa2: dGem(binnen(OMSLAG[1])), vuurNa2: kans(binnen(OMSLAG[1])), eersteNa2: eerste(OMSLAG[1]),
    vuurTotaal: rijp.filter(r => r.signaalVuur).length
  };
}

module.exports = { maakMaten, poortMaten };
