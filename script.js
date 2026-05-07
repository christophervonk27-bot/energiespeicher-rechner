/**
 * Gewerbespeicher Rechner - SPEICHER-ALLEIN-AMORTISATION
 * Berechnet die Amortisation des Speichers unabhängig von der PV-Anlage
 * Mit PV-Nutzquote als Eingabe
 */

// Lastprofile für Gewerbe
const LASTPROFILE = {
    gleichmaessig: { name: 'Gleichmäßig (24/7)', faktor: 0.60 },
    tag: { name: 'Taglast (8-18 Uhr)', faktor: 0.45 },
    schicht: { name: 'Schichtbetrieb', faktor: 0.55 },
    spitze: { name: 'Spitzenlast', faktor: 0.75 }
};

// Standardwerte 2026
const DEFAULTS = {
    verbrauch: 50000,        // kWh/Jahr
    pvLeistung: 50,          // kWp (nur zur Info, nicht für Berechnung)
    pvNutzquote: 30,         // % des Bedarfs, die die PV bereits deckt
    lastprofil: 'gleichmaessig',
    autarkie: 70,            // %
    strompreis: 0.30,        // €/kWh
    einspeiseverguetung: 0.06, // €/kWh
    speicherKosten: 450,     // €/kWh
    lebensdauer: 15,        // Jahre
    wirkungsgrad: 96         // %
};

let amortisationChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadDefaults();
    document.getElementById('berechnen-btn').addEventListener('click', berechnen);
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('keypress', (e) => e.key === 'Enter' && berechnen());
    });
    initChart();
});

function loadDefaults() {
    document.getElementById('verbrauch').value = DEFAULTS.verbrauch;
    document.getElementById('pv-leistung').value = DEFAULTS.pvLeistung;
    document.getElementById('pv-nutzquote').value = DEFAULTS.pvNutzquote;
    document.getElementById('lastprofil').value = DEFAULTS.lastprofil;
    document.getElementById('autarkie').value = DEFAULTS.autarkie;
    document.getElementById('strompreis').value = DEFAULTS.strompreis;
    document.getElementById('einspeiseverguetung').value = DEFAULTS.einspeiseverguetung;
    document.getElementById('speicher-kosten').value = DEFAULTS.speicherKosten;
    document.getElementById('lebensdauer').value = DEFAULTS.lebensdauer;
    document.getElementById('wirkungsgrad').value = DEFAULTS.wirkungsgrad;
}

function berechnen() {
    const input = {
        verbrauch: parseFloat(document.getElementById('verbrauch').value) || 0,
        pvNutzquote: parseFloat(document.getElementById('pv-nutzquote').value) || 0,
        lastprofil: document.getElementById('lastprofil').value,
        autarkie: parseFloat(document.getElementById('autarkie').value) || 0,
        strompreis: parseFloat(document.getElementById('strompreis').value) || 0,
        einspeiseverguetung: parseFloat(document.getElementById('einspeiseverguetung').value) || 0,
        speicherKosten: parseFloat(document.getElementById('speicher-kosten').value) || 0,
        lebensdauer: parseFloat(document.getElementById('lebensdauer').value) || 0,
        wirkungsgrad: parseFloat(document.getElementById('wirkungsgrad').value) || 0
    };

    if (!validateInput(input)) {
        alert('Bitte alle Felder mit gültigen Werten ausfüllen!');
        return;
    }

    const results = calculateResults(input);
    displayResults(results);
    updateChart(results);
}

function validateInput(input) {
    return (
        input.verbrauch > 0 &&
        input.pvNutzquote >= 0 && input.pvNutzquote <= 100 &&
        input.autarkie >= 0 && input.autarkie <= 100 &&
        input.strompreis > 0 &&
        input.einspeiseverguetung >= 0 &&
        input.speicherKosten > 0 &&
        input.lebensdauer > 0 &&
        input.wirkungsgrad >= 80 && input.wirkungsgrad <= 100
    );
}

// ===== BERECHNUNGSLOGIK (NUR SPEICHER) =====
function calculateResults(input) {
    const profil = LASTPROFILE[input.lastprofil];
    const eta = input.wirkungsgrad / 100;

    // 1. Aktueller Eigenverbrauch (durch PV)
    const aktuellerEigenverbrauch = input.verbrauch * (input.pvNutzquote / 100);

    // 2. Aktueller Netzbezug
    const netzbezugAktuell = input.verbrauch - aktuellerEigenverbrauch;

    // 3. Überschuss (wird aktuell eingespeist)
    // Annahme: PV-Ertrag = aktueller Eigenverbrauch / Direktverbrauchsquote
    // (Da wir keine PV-Leistung für die Berechnung brauchen, schätzen wir den Überschuss)
    const direktverbrauchsquote = profil.faktor;
    const pvErtrag = aktuellerEigenverbrauch / direktverbrauchsquote;
    const überschussAktuell = pvErtrag - aktuellerEigenverbrauch;

    // ===== SPEICHERGRÖßENBERECHNUNG =====
    // Ziel: Gewünschten Autarkiegrad erreichen
    // 1. Wie viel Strom fehlt noch für den gewünschten Autarkiegrad?
    const fehlenderStrom = input.verbrauch * (input.autarkie / 100) - aktuellerEigenverbrauch;

    // 2. Tagesbedarf für Speicher
    const tagesBedarf = fehlenderStrom / 365;

    // 3. Benötigte Speichergröße (kWh)
    const speicherGroesse = Math.min(
        tagesBedarf * 1.5,  // 50% Puffer für Nachtverbrauch
        überschussAktuell * 0.20  // Maximal 20% des Jahresüberschusses
    );

    // Mindestgröße: 10 kWh, Maximalgröße: 2000 kWh
    const empfohleneSpeicherGroesse = Math.max(10, Math.min(speicherGroesse, 2000));

    // ===== ERREICHBARER AUTARKIEGRAD =====
    // Wie viel Strom kann tatsächlich durch den Speicher abgedeckt werden?
    const speicherNutzungProJahr = Math.min(
        empfohleneSpeicherGroesse * 365 * eta,
        überschussAktuell * eta
    );

    const eigenverbrauchMitSpeicher = aktuellerEigenverbrauch + speicherNutzungProJahr;
    const erreichterAutarkie = Math.min(
        (eigenverbrauchMitSpeicher / input.verbrauch) * 100,
        100
    );

    // ===== INVESTITIONSKOSTEN (NUR SPEICHER) =====
    const investition = empfohleneSpeicherGroesse * input.speicherKosten;

    // ===== JÄHRLICHE EINSPARUNG (NUR DURCH SPEICHER) =====
    // Einsparung = (Mehr Eigenverbrauch durch Speicher) * Strompreis
    // + (Weniger Einspeisung) * (Strompreis - Einspeisevergütung)
    const mehrEigenverbrauch = speicherNutzungProJahr;
    const wenigerEinspeisung = Math.min(überschussAktuell, speicherNutzungProJahr / eta);

    const einsparungDurchEigenverbrauch = mehrEigenverbrauch * input.strompreis;
    const einsparungDurchReduzierteEinspeisung = wenigerEinspeisung * (input.strompreis - input.einspeiseverguetung);
    const jaehrlicheEinsparung = einsparungDurchEigenverbrauch + einsparungDurchReduzierteEinspeisung;

    // ===== AMORTISATIONSZEIT (NUR SPEICHER) =====
    const amortisationszeit = jaehrlicheEinsparung > 0
        ? investition / jaehrlicheEinsparung
        : 999;

    // ===== JÄHRLICHE RENDITE =====
    const jaehrlicheRendite = jaehrlicheEinsparung > 0
        ? (jaehrlicheEinsparung / investition) * 100
        : 0;

    // ===== AMORTISATIONSVERLAUF =====
    const amortisationsVerlauf = calculateAmortisationVerlauf(
        investition,
        jaehrlicheEinsparung,
        input.lebensdauer
    );

    return {
        speicherGroesse: Math.round(empfohleneSpeicherGroesse),
        erreichterAutarkie: Math.round(erreichterAutarkie * 10) / 10,
        investition: Math.round(investition),
        jaehrlicheEinsparung: Math.round(jaehrlicheEinsparung),
        amortisationszeit: Math.round(amortisationszeit * 10) / 10,
        jaehrlicheRendite: Math.round(jaehrlicheRendite * 10) / 10,
        pvErtrag: Math.round(pvErtrag),
        aktuellerEigenverbrauch: Math.round(aktuellerEigenverbrauch),
        überschussAktuell: Math.round(überschussAktuell),
        amortisationsVerlauf: amortisationsVerlauf
    };
}

function calculateAmortisationVerlauf(investition, jaehrlicheEinsparung, lebensdauer) {
    const verlauf = [];
    let kumuliert = 0;

    for (let jahr = 1; jahr <= lebensdauer * 2; jahr++) {
        if (jahr <= lebensdauer) {
            kumuliert += jaehrlicheEinsparung;
        } else {
            kumuliert += jaehrlicheEinsparung * 0.8;
        }

        verlauf.push({
            jahr: jahr,
            kumuliert: kumuliert,
            investition: investition,
            amortisiert: kumuliert >= investition
        });

        if (kumuliert >= investition) break;
    }

    return verlauf;
}

function displayResults(results) {
    document.getElementById('speicher-groesse').textContent = `${formatNumber(results.speicherGroesse)} kWh`;
    document.getElementById('erreichter-autarkie').textContent = `${formatNumber(results.erreichterAutarkie)} %`;
    document.getElementById('investition').textContent = formatCurrency(results.investition);
    document.getElementById('einsparung').textContent = `${formatCurrency(results.jaehrlicheEinsparung)} / Jahr`;
    document.getElementById('amortisation').textContent = `${formatNumber(results.amortisationszeit)} Jahre`;
    document.getElementById('rendite').textContent = `${formatNumber(results.jaehrlicheRendite)} %`;
    document.getElementById('ergebnis').scrollIntoView({ behavior: 'smooth' });
}

function initChart() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = createChart;
    document.head.appendChild(script);
}

function createChart() {
    const ctx = document.getElementById('amortisation-chart').getContext('2d');
    amortisationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Kumulierte Einsparung',
                data: [],
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: 'Investition',
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Einsparung (€)' }
                },
                x: {
                    title: { display: true, text: 'Jahre' }
                }
            }
        }
    });
}

function updateChart(results) {
    if (!amortisationChart) return;
    const verlauf = results.amortisationsVerlauf;
    amortisationChart.data.labels = verlauf.map(v => `Jahr ${v.jahr}`);
    amortisationChart.data.datasets[0].data = verlauf.map(v => v.kumuliert);
    amortisationChart.data.datasets[1].data = verlauf.map(v => v.investition);
    amortisationChart.update();
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCurrency(amount) {
    return `${formatNumber(Math.round(amount))} €`;
}