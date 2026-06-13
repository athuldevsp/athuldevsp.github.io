/* ============================================================
   Publications Data & Renderer
   Loads publication data and renders cards on the page.
   
   Since Google Scholar doesn't provide a public API, we use a
   curated list that can be updated periodically. A helper
   script (update_publications.py) is provided to scrape fresh
   data if needed.
   ============================================================ */

const PUBLICATIONS = [
    {
        title: "Search for dark matter produced in association with a pair of tau leptons in pp collisions at √s = 13 TeV with the ATLAS detector",
        authors: "ATLAS Collaboration",
        venue: "Physical Review D",
        year: 2024,
        citations: 12,
        url: "https://arxiv.org/abs/2404.00173",
        type: "paper"
    },
    {
        title: "Measurement of the Higgs boson mass in the H → ZZ* → 4ℓ decay channel using 140 fb⁻¹ of √s = 13 TeV pp collisions",
        authors: "ATLAS Collaboration",
        venue: "Physics Letters B",
        year: 2024,
        citations: 45,
        url: "https://arxiv.org/abs/2401.02275",
        type: "paper"
    },
    {
        title: "A search for heavy Higgs bosons decaying into vector bosons in same-sign two-lepton final states in pp collisions at √s = 13 TeV",
        authors: "ATLAS Collaboration",
        venue: "Journal of High Energy Physics",
        year: 2024,
        citations: 8,
        url: "https://arxiv.org/abs/2404.01292",
        type: "paper"
    },
    {
        title: "Search for pair production of higgsinos in events with two Higgs bosons and missing transverse momentum",
        authors: "ATLAS Collaboration",
        venue: "Physical Review D",
        year: 2024,
        citations: 6,
        url: "https://arxiv.org/abs/2401.14922",
        type: "paper"
    },
    {
        title: "Transformer-based identification of hadronically decaying tau leptons at the ATLAS trigger",
        authors: "A. D. S. Ponnu (on behalf of the ATLAS Collaboration)",
        venue: "DPG Spring Meeting, Dortmund",
        year: 2024,
        citations: 0,
        url: "https://www.dpg-verhandlungen.de/year/2024/conference/dortmund/part/t/session/89",
        type: "talk"
    },
    {
        title: "High Level Trigger Optimization Studies in the ATLAS Search for Higgs Boson Pair Production in the HH → bb̄ τ⁺τ⁻ Channel",
        authors: "Athul Dev Sudhakar Ponnu",
        venue: "Master's Thesis, University of Göttingen",
        year: 2023,
        citations: 0,
        url: "https://www.uni-goettingen.de/en/664047.html",
        type: "thesis"
    },
    {
        title: "Constraints on the Higgs boson self-coupling from single and double Higgs boson production at the LHC",
        authors: "ATLAS Collaboration",
        venue: "Physics Letters B",
        year: 2023,
        citations: 18,
        url: "https://arxiv.org/abs/2211.01216",
        type: "paper"
    },
    {
        title: "Search for Higgs boson pair production in the bb̄ τ⁺τ⁻ final state with 140 fb⁻¹ of pp collision data",
        authors: "ATLAS Collaboration",
        venue: "ATLAS-CONF-2023",
        year: 2023,
        citations: 15,
        url: "https://cds.cern.ch/record/2845544",
        type: "paper"
    },
    {
        title: "Measurements of Higgs boson production cross-sections in the H → τ⁺τ⁻ decay channel in pp collisions at √s = 13 TeV",
        authors: "ATLAS Collaboration",
        venue: "Journal of High Energy Physics",
        year: 2023,
        citations: 30,
        url: "https://arxiv.org/abs/2201.08269",
        type: "paper"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('pub-list');
    const statPubs = document.getElementById('stat-pubs');
    if (!list) return;

    // Update stats
    if (statPubs) statPubs.textContent = PUBLICATIONS.length;

    // Sort by year desc, then citations desc
    const sorted = [...PUBLICATIONS].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.citations - a.citations;
    });

    // Render
    list.innerHTML = sorted.map(pub => {
        const typeLabel = pub.type === 'thesis' ? 'Thesis' :
                         pub.type === 'talk' ? 'Conference Talk' : 'Paper';
        const typeBadge = pub.type !== 'paper' ?
            `<span class="pub-year" style="background: rgba(255, 169, 77, 0.08); border-color: rgba(255, 169, 77, 0.15); color: var(--accent-warm);">${typeLabel}</span>` : '';

        return `
            <div class="pub-card">
                <h3><a href="${pub.url}" target="_blank" rel="noopener">${pub.title}</a></h3>
                <p class="pub-authors">${pub.authors}</p>
                <p class="pub-venue">${pub.venue}</p>
                <div class="pub-meta">
                    <span class="pub-year">${pub.year}</span>
                    ${typeBadge}
                    ${pub.citations > 0 ? `<span class="pub-citations">${pub.citations} citations</span>` : ''}
                    <a href="${pub.url}" target="_blank" rel="noopener" class="pub-link">
                        View →
                    </a>
                </div>
            </div>
        `;
    }).join('');
});
