/**
 * Gewerbespeicher Rechner
 * Berechnet die optimale Speichergröße und Amortisation für Gewerbespeicher
 */

// Lastprofile und ihre typischen Eigenverbrauchsquoten
const LASTPROFILE = {
    gleichmaessig: {
        name: 'Gleichmäßig',
        eigenverbrauch: 0.3,  // 30% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.8   // 80% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    tag: {
        name: 'Taglast (z.B. Büro)',
        eigenverbrauch: 0.5,  // 50% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.6   // 60% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    schicht: {
        name: 'Schichtbetrieb',
        eigenverbrauch: 0.4,  // 40% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.7   // 70% des Verbrauchs kann durch Speicher abgedeckt werden
    },
    spitze: {
        name: 'Spitzenlast',
        eigenverbrauch: 0.2,  // 20% des PV-Stroms kann direkt genutzt werden
        speicherbedarf: 0.9   // 90% des Verbrauchs kann durch Speicher abgedeckt werden
    }
};

// Standardwerte für die Berechnung
const DEFAULTS = {
    verbrauch: 50000,       // kWh/Jahr
    pvLeistung: 30,         // kWp
    autarkie: 70,           // %
    strompreis: 0.25,       // €/kWh
    einspeiseverguetung: 0.08, // €/kWh
    speicherKosten: 500,    // €/kWh
    lebensdauer: 15,       // Jahre
    wirkungsgrad: 95        // %
};

// Chart-Referenz für Amortisationsverlauf
let amortisationChart = null;

/**
 * Initialisiert die WebApp
 */
document.addEventListener('DOMContentLoaded', function() {
    // Standardwerte in die Eingabefelder laden
    loadDefaults();
    
    // Event-Listener für den Berechnen-Button
    document.getElementById('berechnen-btn').addEventListener('click', berechnen);
    
    // Event-Listener für Enter-Taste in Eingabefeldern
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                berechnen();
            }
        });
    });
    
    // Chart.js laden und initialisieren
    initChart();
});

/**
 * Lädt die Standardwerte in die Eingabefelder
 */
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

/**
 * Hauptfunktion zur Berechnung
 */
function berechnen() {
    // Eingabewerte einlesen
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
    
    // Validierung
    if (!validateInput(input)) {
        alert('Bitte füllen Sie alle Felder mit gültigen Werten aus.');
        return;
    }
    
    // Berechnungen durchführen
    const ergebnisse = calculateResults(input);
    
    // Ergebnisse anzeigen
    displayResults(ergebnisse);
    
    // Chart aktualisieren
    updateChart(ergebnisse);
}

/**
 * Validiert die Eingabewerte
 */
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

/**
 * Führt alle Berechnungen durch
 */
function calculateResults(input) {
    const profil = LASTPROFILE[input.lastprofil];
    const wirkungsgrad = input.wirkungsgrad / 100;
    
    // 1. PV-Ertrag berechnen (kWh/Jahr)
    // Annahme: 1 kWp = 900-1100 kWh/Jahr in Deutschland (Mittelwert: 1000 kWh/kWp)
    const pvErtrag = input.pvLeistung * 1000;
    
    // 2. Direktverbrauch ohne Speicher
    const direktVerbrauch = Math.min(pvErtrag * profil.eigenverbrauch, input.verbrauch);
    
    // 3. Überschussstrom (kann gespeichert oder eingespeist werden)
    const überschuss = pvErtrag - direktVerbrauch;
    
    // 4. Benötigte Speichergröße berechnen
    // Ziel: gewünschter Autarkiegrad
    const verbrauchOhnePV = input.verbrauch - direktVerbrauch;
    const speicherBedarfFürAutarkie = (verbrauchOhnePV * (input.autarkie / 100)) / profil.speicherbedarf;
    
    // Alternative Berechnung basierend auf Überschuss
    // Der Speicher kann nur so viel aufnehmen wie Überschuss vorhanden ist
    const maxSpeicherAusÜberschuss = überschuss * wirkungsgrad;
    
    // Empfohlene Speichergröße ist das Minimum aus beiden Werten
    // Aber mindestens so groß, dass der gewünschte Autarkiegrad erreicht wird
    let empfohleneSpeicherGroesse = Math.min(speicherBedarfFürAutarkie, maxSpeicherAusÜberschuss);
    
    // Wenn PV zu klein ist, um den gewünschten Autarkiegrad zu erreichen
    if (pvErtrag < input.verbrauch * (input.autarkie / 100)) {
        // Speichergröße basierend auf verfügbarem Überschuss
        empfohleneSpeicherGroesse = überschuss * wirkungsgrad;
    }
    
    // Mindestgröße: 5 kWh, Maximalgröße: 2x jährlicher Verbrauch
    empfohleneSpeicherGroesse = Math.max(5, Math.min(empfohleneSpeicherGroesse, input.verbrauch * 2));
    
    // 5. Erreichbarer Autarkiegrad mit empfohlener Speichergröße
    const speicherNutzung = Math.min(empfohleneSpeicherGroesse, überschuss * wirkungsgrad);
    const eigenverbrauchMitSpeicher = direktVerbrauch + speicherNutzung;
    const erreichterAutarkie = Math.min((eigenverbrauchMitSpeicher / input.verbrauch) * 100, 100);
    
    // 6. Investitionskosten
    const investition = empfohleneSpeicherGroesse * input.speicherKosten;
    
    // 7. Jährliche Einsparung
    // Einsparung = (Eigenverbrauch mit Speicher - Eigenverbrauch ohne Speicher) * Strompreis
    // + (Überschuss ohne Speicher - Überschuss mit Speicher) * Einspeisevergütung
    const einsparungOhneSpeicher = direktVerbrauch * input.strompreis + überschuss * input.einspeiseverguetung;
    const überschussMitSpeicher = Math.max(0, überschuss - (speicherNutzung / wirkungsgrad));
    const einsparungMitSpeicher = eigenverbrauchMitSpeicher * input.strompreis + überschussMitSpeicher * input.einspeiseverguetung;
    const jaehrlicheEinsparung = einsparungMitSpeicher - einsparungOhneSpeicher;
    
    // 8. Amortisationszeit
    let amortisationszeit = investition / jaehrlicheEinsparung;
    
    // Wenn die Amortisation länger als die Lebensdauer dauert
    if (amortisationszeit > input.lebensdauer) {
        amortisationszeit = input.lebensdauer + ((amortisationszeit - input.lebensdauer) * 0.5);
    }
    
    // 9. Jährliche Rendite
    const jaehrlicheRendite = (jaehrlicheEinsparung / investition) * 100;
    
    // 10. Amortisationsverlauf für Chart
    const amortisationsVerlauf = calculateAmortisationVerlauf(
        investition, 
        jaehrlicheEinsparung, 
        input.lebensdauer
    );
    
    return {
        input: input,
        profil: profil,
        pvErtrag: pvErtrag,
        direktVerbrauch: direktVerbrauch,
        überschuss: überschuss,
        empfohleneSpeicherGroesse: Math.round(empfohleneSpeicherGroesse),
        erreichterAutarkie: Math.round(erreichterAutarkie * 10) / 10,
        investition: Math.round(investition),
        jaehrlicheEinsparung: Math.round(jaehrlicheEinsparung),
        amortisationszeit: Math.round(amortisationszeit * 10) / 10,
        jaehrlicheRendite: Math.round(jaehrlicheRendite * 10) / 10,
        amortisationsVerlauf: amortisationsVerlauf
    };
}

/**
 * Berechnet den Amortisationsverlauf über die Jahre
 */
function calculateAmortisationVerlauf(investition, jaehrlicheEinsparung, lebensdauer) {
    const verlauf = [];
    let kumulierteEinsparung = 0;
    
    for (let jahr = 1; jahr <= lebensdauer * 2; jahr++) {
        kumulierteEinsparung += jaehrlicheEinsparung;
        
        // Nach der Lebensdauer sinkt die Einsparung (Speicher muss ersetzt werden)
        if (jahr > lebensdauer) {
            // Annahme: 50% der ursprünglichen Einsparung
            kumulierteEinsparung += jaehrlicheEinsparung * 0.5 * (jahr - lebensdauer);
        }
        
        verlauf.push({
            jahr: jahr,
            kumuliert: kumulierteEinsparung,
            investition: investition,
            amortisiert: kumulierteEinsparung >= investition
        });
        
        // Abbruch wenn amortisiert
        if (kumulierteEinsparung >= investition) {
            break;
        }
    }
    
    return verlauf;
}

/**
 * Zeigt die Ergebnisse an
 */
function displayResults(ergebnisse) {
    // Werte formatieren
    document.getElementById('speicher-groesse').textContent = 
        formatNumber(ergebnisse.empfohleneSpeicherGroesse) + ' kWh';
    
    document.getElementById('erreichter-autarkie').textContent = 
        formatNumber(ergebnisse.erreichterAutarkie) + ' %';
    
    document.getElementById('investition').textContent = 
        formatCurrency(ergebnisse.investition);
    
    document.getElementById('einsparung').textContent = 
        formatCurrency(ergebnisse.jaehrlicheEinsparung) + ' / Jahr';
    
    document.getElementById('amortisation').textContent = 
        formatNumber(ergebnisse.amortisationszeit) + ' Jahre';
    
    document.getElementById('rendite').textContent = 
        formatNumber(ergebnisse.jaehrlicheRendite) + ' %';
    
    // Ergebnisbereich einblenden
    document.getElementById('ergebnis').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Initialisiert das Chart
 */
function initChart() {
    // Chart.js über CDN laden
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = function() {
        createChart();
    };
    document.head.appendChild(script);
}

/**
 * Erstellt das Chart-Objekt
 */
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
                    title: {
                        display: true,
                        text: 'Einsparung (€)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Jahre'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Investition') {
                                return 'Investition: ' + formatCurrency(context.parsed.y);
                            }
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Aktualisiert das Chart mit neuen Daten
 */
function updateChart(ergebnisse) {
    if (!amortisationChart) return;
    
    const verlauf = ergebnisse.amortisationsVerlauf;
    
    // Daten für das Chart vorbereiten
    const labels = verlauf.map(v => 'Jahr ' + v.jahr);
    const einsparungData = verlauf.map(v => v.kumuliert);
    const investitionData = verlauf.map(v => v.investition);
    
    // Chart aktualisieren
    amortisationChart.data.labels = labels;
    amortisationChart.data.datasets[0].data = einsparungData;
    amortisationChart.data.datasets[1].data = investitionData;
    
    // Amortisationspunkt markieren
    const amortisationsJahr = verlauf.find(v => v.amortisiert);
    if (amortisationsJahr) {
        amortisationChart.data.datasets[0].pointBackgroundColor = verlauf.map(v => 
            v.amortisiert ? '#e74c3c' : '#27ae60'
        );
        amortisationChart.data.datasets[0].pointRadius = verlauf.map(v => 
            v.amortisiert ? 6 : 0
        );
    }
    
    amortisationChart.update();
}

/**
 * Formatiert eine Zahl mit Tausendertrennzeichen
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formatiert einen Währungsbetrag
 */
function formatCurrency(amount) {
    return formatNumber(Math.round(amount)) + ' €';
}

/**
 * Zeigt eine Fehlermeldung an
 */
function showError(message) {
    alert('Fehler: ' + message);
}

// Export für Tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateResults,
        calculateAmortisationVerlauf,
        validateInput,
        LASTPROFILE,
        DEFAULTS
    };
}