/**
 * Gewerbespeicher Rechner - ANGEPASSTE VERSION
 * Berechnet Speichergröße, Autarkiegrad und Amortisation für Gewerbespeicher
 * Basierend auf der korrigierten Logik mit Iteration über Speichergrößen
 */

// Lastprofile (werden für Autarkiegrad-Berechnung genutzt)
const LASTPROFILE = {
    gleichmaessig: { name: 'Gleichmäßig (24/7)', direktverbrauch: 0.35, speicherbedarf: 0.65 },
    tag: { name: 'Taglast (8-18 Uhr)', direktverbrauch: 0.60, speicherbedarf: 0.50 },
    schicht: { name: 'Schichtbetrieb', direktverbrauch: 0.45, speicherbedarf: 0.55 },
    spitze: { name: 'Spitzenlast', direktverbrauch: 0.20, speicherbedarf: 0.80 }
};

// Standardwerte
const DEFAULTS = {
    verbrauch: 50000,
    pvLeistung: 50,
    autarkie: 70,
    strompreis: 0.25,
    einspeiseverguetung: 0.08,
    speicherKosten: 600,
    lebensdauer: 15,
    wirkungsgrad: 95
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

// ===== NEUE BERECHNUNGSLOGIK (korrigiert nach Excel-Tool) =====
function calculateResults(input) {
    // Abbildung der Inputs auf die neue Logik
    const gridConsumption = input.verbrauch; // Strombezug aus Netz
    const pvSurplus = input.pvLeistung * 1000; // PV-Überschuss (kWh/Jahr) = PV-Leistung (kWp) × 1000
    const totalConsumption = input.verbrauch; // Gesamtverbrauch = Strombezug (Vereinfachung)
    const electricityPrice = input.strompreis;
    const feedInTariff = input.einspeiseverguetung;
    const batteryEfficiency = input.wirkungsgrad / 100;
    const variableStorageCost = input.speicherKosten;
    const fixedStorageCost = 0; // Keine fixen Kosten im Original-Skript
    const fullCycles = 260; // Standard: 260 Vollzyklen/Jahr für Gewerbe
    const considerationPeriod = input.lebensdauer;
    const maintenanceRate = 0.005; // Standard: 0,5% Wartung
    const maxStorageSize = 500; // Maximale Speichergröße (kWh)
    const amortizationThreshold = 10; // Grenzwert für Wirtschaftlichkeit (Jahre)

    const savingsPerKWh = electricityPrice - feedInTariff;

    // Berechne Direktverbrauch aus Lastprofil
    const profil = LASTPROFILE[input.lastprofil];
    const directConsumption = Math.min(pvSurplus * profil.direktverbrauch, totalConsumption);

    let bestResult = null;
    let bestNetAdvantage = -Infinity;

    // Iteriere durch alle Speichergrößen (25, 50, 75, ..., maxStorageSize)
    for (let size = 25; size <= maxStorageSize; size += 25) {
        // 1. Nutzbare Entladung = min(Speichergröße × Vollzyklen × Wirkungsgrad, Strombezug)
        const usableDischarge = Math.min(
            size * fullCycles * batteryEfficiency,
            gridConsumption
        );

        // 2. Zusätzlicher Eigenverbrauch = Nutzbare Entladung
        const additionalConsumption = usableDischarge;

        // 3. Rest-Netzbezug = Strombezug - Zusätzlicher Eigenverbrauch (mind. 0)
        const restGridConsumption = Math.max(
            gridConsumption - additionalConsumption,
            0
        );

        // 4. Rest-Einspeisung = PV-Überschuss - (Zusätzlicher Eigenverbrauch / Wirkungsgrad) (mind. 0)
        const restFeedIn = Math.max(
            pvSurplus - (additionalConsumption / batteryEfficiency),
            0
        );

        // 5. Brutto-Ersparnis = Zusätzlicher Eigenverbrauch × (Strompreis - Einspeisevergütung)
        const grossSavings = additionalConsumption * savingsPerKWh;

        // 6. Investition = Speichergröße × variable Kosten + fixe Kosten
        const investment = size * variableStorageCost + fixedStorageCost;

        // 7. Wartung = Investition × Wartungssatz
        const maintenance = investment * maintenanceRate;

        // 8. Netto-Nutzen/Jahr = Brutto-Ersparnis - Wartung
        const netBenefit = grossSavings - maintenance;

        // 9. Amortisation = Investition / Netto-Nutzen (falls Netto-Nutzen > 0)
        const amortization = netBenefit > 0 ? investment / netBenefit : Infinity;

        // 10. Netto-Vorteil über Betrachtungszeitraum = (Netto-Nutzen × Zeitraum) - Investition
        const netAdvantage = netBenefit * considerationPeriod - investment;

        // 11. Bewertung: wirtschaftlich, wenn Amortisation ≤ Grenzwert
        const rating = amortization <= amortizationThreshold ? 'wirtschaftlich' : 'prüfen';

        // Wähle die Speichergröße mit dem höchsten Netto-Vorteil
        if (netAdvantage > bestNetAdvantage) {
            bestNetAdvantage = netAdvantage;
            bestResult = {
                size,
                additionalConsumption,
                restGridConsumption,
                restFeedIn,
                grossSavings,
                investment,
                maintenance,
                netBenefit,
                amortization,
                netAdvantage,
                rating,
                usableDischarge,
                savingsPerKWh
            };
        }
    }

    // Berechne den erreichten Autarkiegrad
    const totalSelfConsumption = directConsumption + (bestResult ? bestResult.additionalConsumption : 0);
    const reachedAutarky = Math.min((totalSelfConsumption / totalConsumption) * 100, 100);

    // Berechne Amortisationsverlauf für Chart
    const amortisationVerlauf = calculateAmortisationVerlauf(
        bestResult.investment,
        bestResult.netBenefit,
        considerationPeriod
    );

    return {
        ...bestResult,
        speicherGroesse: bestResult.size,
        erreichterAutarkie: reachedAutarky,
        pvErtrag: pvSurplus,
        direktVerbrauch: directConsumption,
        überschuss: pvSurplus - directConsumption,
        amortisationsVerlauf: amortisationVerlauf
    };
}

// ===== AMORTISATIONSVERLAUF =====
function calculateAmortisationVerlauf(investition, netBenefit, considerationPeriod) {
    const verlauf = [];
    let kumuliert = 0;

    for (let jahr = 1; jahr <= considerationPeriod * 2; jahr++) {
        if (jahr <= considerationPeriod) {
            kumuliert += netBenefit;
        } else {
            // Nach Lebensdauer: 80% der ursprünglichen Einsparung (neuer Speicher)
            kumuliert += netBenefit * 0.8;
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
    if (!results) return;

    document.getElementById('speicher-groesse').textContent = `${formatNumber(results.speicherGroesse)} kWh`;
    document.getElementById('erreichter-autarkie').textContent = `${formatNumber(results.erreichterAutarkie.toFixed(1))} %`;
    document.getElementById('investition').textContent = formatCurrency(results.investment);
    document.getElementById('einsparung').textContent = `${formatCurrency(results.netBenefit)} / Jahr`;
    document.getElementById('amortisation').textContent = `${formatNumber(results.amortization.toFixed(1))} Jahre`;
    document.getElementById('rendite').textContent = `${formatNumber((results.netBenefit / results.investment) * 100).toFixed(1)} %`;
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