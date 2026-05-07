/**
 * Gewerbespeicher Rechner (korrigierte Version)
 * Berechnet die optimale Speichergröße und Amortisation für Gewerbespeicher
 */

// Lastprofile mit realistischen Werten für Gewerbekunden
const LASTPROFILE = {
    gleichmaessig: {
        name: 'Gleichmäßig (24/7 Betrieb)',
        eigenverbrauch: 0.4,   // 40% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.7    // 70% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    tag: {
        name: 'Taglast (z. B. Büro, 8–18 Uhr)',
        eigenverbrauch: 0.6,   // 60% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.5    // 50% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    schicht: {
        name: 'Schichtbetrieb (z. B. 2-Schicht-System)',
        eigenverbrauch: 0.5,   // 50% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.6    // 60% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    spitze: {
        name: 'Spitzenlast (z. B. kurze Hochlastphasen)',
        eigenverbrauch: 0.2,   // 20% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.8    // 80% des Verbrauchs kann durch Speicher abgedeckt werden
    }
};

// Standardwerte für Deutschland
const DEFAULTS = {
    verbrauch: 50000,        // kWh/Jahr (typisch für Gewerbebetrieb)
    pvLeistung: 50,          // kWp (typische Gewerbeanlage)
    autarkie: 70,            // %
    strompreis: 0.25,        // €/kWh (Gewerbestrompreis 2024)
    einspeiseverguetung: 0.08, // €/kWh (EEG 2024 für Gewerbe)
    speicherKosten: 600,     // €/kWh (inkl. Installation, 2024)
    lebensdauer: 15,        // Jahre (Lithium-Ionen-Speicher)
    wirkungsgrad: 95         // % (Round-Trip-Efficiency)
};

let amortisationChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadDefaults();
    document.getElementById('berechnen-btn').addEventListener('click', berechnen);
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') berechnen();
        });
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
        alert('Bitte füllen Sie alle Felder mit gültigen Werten aus.');
        return;
    }

    const ergebnisse = calculateResults(input);
    displayResults(ergebnisse);
    updateChart(ergebnisse);
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

// ===== KORRIGIERTE BERECHNUNGSLOGIK =====
function calculateResults(input) {
    const profil = LASTPROFILE[input.lastprofil];
    const wirkungsgrad = input.wirkungsgrad / 100;

    // 1. PV-Ertrag berechnen (kWh/Jahr)
    // Realistischer Wert für Deutschland: 900-1100 kWh/kWp (Mittelwert: 1000)
    const pvErtrag = input.pvLeistung * 1000;

    // 2. Tagesverbrauch berechnen (für Speicherauslegung relevant)
    const tagesVerbrauch = input.verbrauch / 365;

    // 3. Direktverbrauch ohne Speicher (wie viel PV-Strom wird sofort genutzt?)
    const direktVerbrauch = Math.min(pvErtrag * profil.eigenverbrauch, input.verbrauch);

    // 4. Überschussstrom (kann gespeichert oder eingespeist werden)
    const überschuss = pvErtrag - direktVerbrauch;

    // ===== SPEICHERGRÖßENBERECHNUNG =====
    // Ziel: Gewünschter Autarkiegrad erreichen
    // 1. Wie viel Strom muss durch den Speicher abgedeckt werden?
    const fehlenderStromFürAutarkie = input.verbrauch * (input.autarkie / 100) - direktVerbrauch;

    // 2. Wie viel Überschuss steht zur Speicherung zur Verfügung?
    // Der Speicher kann nur den Überschuss aufnehmen, der nicht direkt verbraucht wird
    const verfügbarerÜberschuss = überschuss;

    // 3. Benötigte Speichergröße (kWh)
    // Annahme: Der Speicher wird einmal täglich voll geladen und entladen
    // Die Speichergröße sollte den Tagesbedarf abdecken, der durch den Speicher gedeckt werden soll
    const tagesBedarfFürAutarkie = fehlenderStromFürAutarkie / 365;
    const empfohleneSpeicherGroesse = Math.min(
        tagesBedarfFürAutarkie * 1.5,  // 1.5x Tagesbedarf für Puffer
        verfügbarerÜberschuss * 0.3     // Maximal 30% des Jahresüberschusses als Speichergröße
    );

    // Mindestgröße: 5 kWh, Maximalgröße: 1000 kWh (für Gewerbe)
    const speicherGroesse = Math.max(5, Math.min(empfohleneSpeicherGroesse, 1000));

    // ===== ERREICHBARER AUTARKIEGRAD =====
    // Wie viel Strom kann tatsächlich durch den Speicher abgedeckt werden?
    const speicherNutzungProTag = Math.min(speicherGroesse, verfügbarerÜberschuss / 365) * wirkungsgrad;
    const speicherNutzungProJahr = speicherNutzungProTag * 365;
    const eigenverbrauchMitSpeicher = direktVerbrauch + speicherNutzungProJahr;
    const erreichterAutarkie = Math.min((eigenverbrauchMitSpeicher / input.verbrauch) * 100, 100);

    // ===== INVESTITIONSKOSTEN =====
    const investition = speicherGroesse * input.speicherKosten;

    // ===== JÄHRLICHE EINSPARUNG =====
    // Einsparung = (Eigenverbrauch mit Speicher - Eigenverbrauch ohne Speicher) * Strompreis
    // + (Überschuss ohne Speicher - Überschuss mit Speicher) * (Strompreis - Einspeisevergütung)
    const überschussMitSpeicher = Math.max(0, überschuss - (speicherNutzungProJahr / wirkungsgrad));
    const einsparungDurchEigenverbrauch = (eigenverbrauchMitSpeicher - direktVerbrauch) * input.strompreis;
    const einsparungDurchReduzierteEinspeisung = (überschuss - überschussMitSpeicher) * (input.strompreis - input.einspeiseverguetung);
    const jaehrlicheEinsparung = einsparungDurchEigenverbrauch + einsparungDurchReduzierteEinspeisung;

    // ===== AMORTISATIONSZEIT =====
    let amortisationszeit = investition / jaehrlicheEinsparung;
    if (amortisationszeit > input.lebensdauer) {
        amortisationszeit = input.lebensdauer + ((amortisationszeit - input.lebensdauer) * 0.3);
    }

    // ===== JÄHRLICHE RENDITE =====
    const jaehrlicheRendite = (jaehrlicheEinsparung / investition) * 100;

    // ===== AMORTISATIONSVERLAUF =====
    const amortisationsVerlauf = calculateAmortisationVerlauf(investition, jaehrlicheEinsparung, input.lebensdauer);

    return {
        speicherGroesse: Math.round(speicherGroesse),
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

function calculateAmortisationVerlauf(investition, jaehrlicheEinsparung, lebensdauer) {
    const verlauf = [];
    let kumulierteEinsparung = 0;

    for (let jahr = 1; jahr <= lebensdauer * 2; jahr++) {
        if (jahr <= lebensdauer) {
            kumulierteEinsparung += jaehrlicheEinsparung;
        } else {
            // Nach der Lebensdauer: 70% der ursprünglichen Einsparung (neuer Speicher)
            kumulierteEinsparung += jaehrlicheEinsparung * 0.7;
        }

        verlauf.push({
            jahr: jahr,
            kumuliert: kumulierteEinsparung,
            investition: investition,
            amortisiert: kumulierteEinsparung >= investition
        });

        if (kumulierteEinsparung >= investition) break;
    }

    return verlauf;
}

function displayResults(ergebnisse) {
    document.getElementById('speicher-groesse').textContent = formatNumber(ergebnisse.speicherGroesse) + ' kWh';
    document.getElementById('erreichter-autarkie').textContent = formatNumber(ergebnisse.erreichterAutarkie) + ' %';
    document.getElementById('investition').textContent = formatCurrency(ergebnisse.investition);
    document.getElementById('einsparung').textContent = formatCurrency(ergebnisse.jaehrlicheEinsparung) + ' / Jahr';
    document.getElementById('amortisation').textContent = formatNumber(ergebnisse.amortisationszeit) + ' Jahre';
    document.getElementById('rendite').textContent = formatNumber(ergebnisse.jaehrlicheRendite) + ' %';
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
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

function updateChart(ergebnisse) {
    if (!amortisationChart) return;
    const verlauf = ergebnisse.amortisationsVerlauf;
    amortisationChart.data.labels = verlauf.map(v => 'Jahr ' + v.jahr);
    amortisationChart.data.datasets[0].data = verlauf.map(v => v.kumuliert);
    amortisationChart.data.datasets[1].data = verlauf.map(v => v.investition);
    amortisationChart.update();
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCurrency(amount) {
    return formatNumber(Math.round(amount)) + ' €';
}