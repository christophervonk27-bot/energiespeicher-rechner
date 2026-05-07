/**
 * Gewerbespeicher Rechner - KORRIGIERTE VERSION 2026
 * Basierend auf aktuellen Marktdaten für Deutschland (2026)
 */

// Aktuelle Lastprofile für Gewerbe (2026)
const LASTPROFILE = {
    gleichmaessig: {
        name: 'Gleichmäßig (24/7 Betrieb)',
        direktverbrauch: 0.40,  // 40% des PV-Stroms wird direkt verbraucht
        speicherbedarf: 0.60     // 60% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    tag: {
        name: 'Taglast (8-18 Uhr, z.B. Büro)',
        direktverbrauch: 0.65,  // 65% des PV-Stroms wird direkt verbraucht
        speicherbedarf: 0.45     // 45% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    schicht: {
        name: 'Schichtbetrieb (2-3 Schichten)',
        direktverbrauch: 0.50,  // 50% des PV-Stroms wird direkt verbraucht
        speicherbedarf: 0.55     // 55% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    spitze: {
        name: 'Spitzenlast (kurze Hochlastphasen)',
        direktverbrauch: 0.25,  // 25% des PV-Stroms wird direkt verbraucht
        speicherbedarf: 0.75     // 75% des Verbrauchs kann durch Speicher abgedeckt werden
    }
};

// Aktuelle Standardwerte für Deutschland 2026
const DEFAULTS = {
    verbrauch: 50000,        // kWh/Jahr (typischer Gewerbebetrieb)
    pvLeistung: 50,          // kWp (typische Gewerbeanlage)
    autarkie: 70,            // %
    strompreis: 0.30,        // €/kWh (Gewerbestrompreis 2026 - gestiegen!)
    einspeiseverguetung: 0.06, // €/kWh (EEG 2026 - gesunken!)
    speicherKosten: 450,     // €/kWh (2026: günstiger durch Skaleneffekte)
    lebensdauer: 15,        // Jahre (moderne Lithium-Ionen-Speicher)
    wirkungsgrad: 96         // % (verbesserte Technologie 2026)
};

let amortisationChart = null;

// ===== INITIALISIERUNG =====
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
    document.getElementById('autarkie').value = DEFAULTS.autarkie;
    document.getElementById('strompreis').value = DEFAULTS.strompreis;
    document.getElementById('einspeiseverguetung').value = DEFAULTS.einspeiseverguetung;
    document.getElementById('speicher-kosten').value = DEFAULTS.speicherKosten;
    document.getElementById('lebensdauer').value = DEFAULTS.lebensdauer;
    document.getElementById('wirkungsgrad').value = DEFAULTS.wirkungsgrad;
}

// ===== HAUPTFUNKTION =====
function berechnen() {
    const input = {
        verbrauch: parseFloat(document.getElementById('verbrauch').value) || 0,
        lastprofil: document.getElementById('lastprofil').value,
        pvLeistung: parseFloat(document.getElementById('pv-leistung').value) || 0,
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
        input.pvLeistung >= 0 &&
        input.autarkie >= 0 && input.autarkie <= 100 &&
        input.strompreis > 0 &&
        input.einspeiseverguetung >= 0 &&
        input.speicherKosten > 0 &&
        input.lebensdauer > 0 &&
        input.wirkungsgrad >= 80 && input.wirkungsgrad <= 100
    );
}

// ===== KORRIGIERTE BERECHNUNGSLOGIK 2026 =====
function calculateResults(input) {
    const profil = LASTPROFILE[input.lastprofil];
    const eta = input.wirkungsgrad / 100; // Wirkungsgrad

    // 1. PV-Ertrag (kWh/Jahr) - Realistisch für Deutschland 2026: 950-1150 kWh/kWp
    const pvErtrag = input.pvLeistung * 1050; // Mittelwert 2026

    // 2. Direktverbrauch (kWh/Jahr)
    const direktVerbrauch = Math.min(pvErtrag * profil.direktverbrauch, input.verbrauch);

    // 3. Überschuss (kWh/Jahr)
    const überschuss = pvErtrag - direktVerbrauch;

    // ===== SPEICHERGRÖßENBERECHNUNG =====
    // Ziel: Gewünschten Autarkiegrad erreichen
    // 1. Wie viel Strom fehlt noch für den gewünschten Autarkiegrad?
    const fehlenderStrom = input.verbrauch * (input.autarkie / 100) - direktVerbrauch;

    // 2. Tagesbedarf für Speicher
    const tagesBedarf = fehlenderStrom / 365;

    // 3. Benötigte Speichergröße (kWh)
    // Berücksichtigt: Tagesbedarf + Puffer für schlechte Tage + verfügbarer Überschuss
    const speicherGroesse = Math.min(
        tagesBedarf * 1.5,  // 50% Puffer für schlechte Tage
        überschuss * 0.20    // Maximal 20% des Jahresüberschusses als Speichergröße
    );

    // Mindestgröße: 10 kWh, Maximalgröße: 1000 kWh (für große Gewerbebetriebe)
    const empfohleneSpeicherGroesse = Math.max(10, Math.min(speicherGroesse, 1000));

    // ===== ERREICHBARER AUTARKIEGRAD =====
    // Wie viel Strom kann tatsächlich durch den Speicher abgedeckt werden?
    const speicherNutzungProJahr = Math.min(
        empfohleneSpeicherGroesse * 365 * eta,  // Maximal mögliche Speichernutzung
        überschuss * eta                        // Begrenzt durch verfügbaren Überschuss
    );
    const eigenverbrauchMitSpeicher = direktVerbrauch + speicherNutzungProJahr;
    const erreichterAutarkie = Math.min(
        (eigenverbrauchMitSpeicher / input.verbrauch) * 100,
        100
    );

    // ===== INVESTITIONSKOSTEN =====
    const investition = empfohleneSpeicherGroesse * input.speicherKosten;

    // ===== JÄHRLICHE EINSPARUNG =====
    // Einsparung = (Eigenverbrauch mit Speicher - Eigenverbrauch ohne Speicher) * Strompreis
    // + (Überschuss ohne Speicher - Überschuss mit Speicher) * (Strompreis - Einspeisevergütung)
    const überschussMitSpeicher = Math.max(0, überschuss - (speicherNutzungProJahr / eta));
    const einsparungDurchEigenverbrauch = (eigenverbrauchMitSpeicher - direktVerbrauch) * input.strompreis;
    const einsparungDurchReduzierteEinspeisung = (überschuss - überschussMitSpeicher) * (input.strompreis - input.einspeiseverguetung);
    const jaehrlicheEinsparung = einsparungDurchEigenverbrauch + einsparungDurchReduzierteEinspeisung;

    // ===== AMORTISATIONSZEIT =====
    const amortisationszeit = jaehrlicheEinsparung > 0
        ? Math.min(investition / jaehrlicheEinsparung, input.lebensdauer * 2)
        : 999; // Falls keine Einsparung möglich

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
        direktVerbrauch: Math.round(direktVerbrauch),
        überschuss: Math.round(überschuss),
        amortisationsVerlauf: amortisationsVerlauf
    };
}

// ===== AMORTISATIONSVERLAUF =====
function calculateAmortisationVerlauf(investition, jaehrlicheEinsparung, lebensdauer) {
    const verlauf = [];
    let kumuliert = 0;

    for (let jahr = 1; jahr <= lebensdauer * 2; jahr++) {
        if (jahr <= lebensdauer) {
            kumuliert += jaehrlicheEinsparung;
        } else {
            // Nach Lebensdauer: 80% der ursprünglichen Einsparung (neuer Speicher)
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

// ===== ANZEIGE DER ERGEBNISSE =====
function displayResults(results) {
    document.getElementById('speicher-groesse').textContent = `${formatNumber(results.speicherGroesse)} kWh`;
    document.getElementById('erreichter-autarkie').textContent = `${formatNumber(results.erreichterAutarkie)} %`;
    document.getElementById('investition').textContent = formatCurrency(results.investition);
    document.getElementById('einsparung').textContent = `${formatCurrency(results.jaehrlicheEinsparung)} / Jahr`;
    document.getElementById('amortisation').textContent = `${formatNumber(results.amortisationszeit)} Jahre`;
    document.getElementById('rendite').textContent = `${formatNumber(results.jaehrlicheRendite)} %`;
    document.getElementById('ergebnis').scrollIntoView({ behavior: 'smooth' });
}

// ===== CHART-FUNKTIONEN =====
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

// ===== HILFSFUNKTIONEN =====
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCurrency(amount) {
    return `${formatNumber(Math.round(amount))} €`;
}