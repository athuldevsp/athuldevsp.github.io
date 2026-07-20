/* ============================================================
   Publications — Loaded from Google Scholar data + Semantic Scholar
   ============================================================ */

const AUTHOR_ID = '2389285019'; // Athul Dev's Semantic Scholar Author ID
let allPublications = [];
let publicationSort = 'date';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ---- Fetch live citation updates from Semantic Scholar author papers ----
async function fetchSemanticScholarUpdates(localPubs) {
    const updated = [...localPubs];
    let liveFetched = false;
    try {
        // Fetch all papers from Semantic Scholar for this author
        const resp = await fetch(`https://api.semanticscholar.org/graph/v1/author/${AUTHOR_ID}?fields=papers.title,papers.citationCount,papers.externalIds`);
        if (resp.ok) {
            liveFetched = true;
            const data = await resp.json();
            const s2Papers = data.papers || [];
            
            // Map S2 papers by title (normalized) or arXiv ID
            const s2Map = new Map();
            s2Papers.forEach(p => {
                if (p.title) {
                    const normTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                    s2Map.set(normTitle, p.citationCount);
                }
                const arxiv = p.externalIds?.ArXiv;
                if (arxiv) {
                    s2Map.set('arxiv:' + arxiv.toLowerCase(), p.citationCount);
                }
            });

            // Update citation counts in our local list
            updated.forEach((pub, idx) => {
                const normTitle = pub.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (s2Map.has(normTitle)) {
                    updated[idx] = { ...pub, citations: s2Map.get(normTitle) };
                } else if (pub.arxivId && s2Map.has('arxiv:' + pub.arxivId.toLowerCase())) {
                    updated[idx] = { ...pub, citations: s2Map.get('arxiv:' + pub.arxivId.toLowerCase()) };
                }
            });
        }
    } catch (e) {
        console.warn('Semantic Scholar live update failed, using pre-scraped citation counts.', e);
    }
    return { publications: updated, liveFetched };
}

function setPublicationFetchTime(source) {
    const el = document.getElementById('publications-last-fetch');
    if (!el) return;
    const formatted = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date());
    el.textContent = `Last fetched: ${formatted} · ${source}`;
}

// ---- Aggregate citation stats ----
function computeStats(pubs) {
    const totalCitations = pubs.reduce((s, p) => s + (p.citations || 0), 0);
    // h-index: largest h s.t. h papers have >= h citations
    const sorted = [...pubs].map(p => p.citations || 0).sort((a, b) => b - a);
    let h = 0;
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] >= i + 1) h = i + 1; else break;
    }
    const i10 = sorted.filter(c => c >= 10).length;
    return { totalCitations, hIndex: h, i10 };
}

function getPublicationMonth(pub) {
    if (Number(pub.month) >= 1 && Number(pub.month) <= 12) return Number(pub.month);

    const namedMonth = String(pub.month || pub.venue || '').match(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
    );
    if (namedMonth) {
        return MONTH_NAMES.findIndex(month => month.toLowerCase() === namedMonth[1].toLowerCase()) + 1;
    }

    const arxivMonth = String(pub.arxivId || '').match(/^\d{2}(0[1-9]|1[0-2])/);
    if (arxivMonth) return Number(arxivMonth[1]);

    // JHEP stores its publication month directly after the year, e.g. 2026 (4).
    const journalMonth = String(pub.venue || '').match(/(?:JHEP|Journal of High Energy Physics)\s+\d{4}\s*\((1[0-2]|[1-9])\)/i);
    return journalMonth ? Number(journalMonth[1]) : 0;
}

function getPublicationJournal(pub) {
    const venue = String(pub.venue || '').trim();
    if (!venue) return 'Unspecified';
    if (/JHEP|Journal of High Energy Physics/i.test(venue)) return 'Journal of High Energy Physics';
    if (/Physical Review Letters/i.test(venue)) return 'Physical Review Letters';
    if (/Physical Review D/i.test(venue)) return 'Physical Review D';
    if (/Physical Review C/i.test(venue)) return 'Physical Review C';
    if (/Physics Letters(?:\. Section)? B/i.test(venue)) return 'Physics Letters B';
    if (/European Physical Journal.*C/i.test(venue)) return 'European Physical Journal C';
    if (/arXiv/i.test(venue)) return 'arXiv';
    if (/^ATLAS-/i.test(venue)) return 'ATLAS public note';
    if (/European Physical Society Conference/i.test(venue)) return 'EPS Conference';
    if (/Gottingen U\./i.test(venue)) return 'University of Göttingen';
    return venue.replace(/\s+(?:19|20)\d{2}.*$/, '').replace(/,?\s+\d+(?:\s*\(\d+\))?.*$/, '').trim() || venue;
}

function populatePublicationFilters(pubs) {
    const yearSelect = document.getElementById('publication-filter-year');
    const monthSelect = document.getElementById('publication-filter-month');
    const journalSelect = document.getElementById('publication-filter-journal');
    if (!yearSelect || !monthSelect || !journalSelect) return;

    const currentYear = yearSelect.value;
    const currentMonth = monthSelect.value;
    const currentJournal = journalSelect.value;
    const years = [...new Set(pubs.map(pub => Number(pub.year)).filter(Boolean))].sort((a, b) => b - a);
    const months = [...new Set(pubs.map(getPublicationMonth).filter(Boolean))].sort((a, b) => a - b);
    const journals = [...new Set(pubs.map(getPublicationJournal))].sort((a, b) => a.localeCompare(b));

    yearSelect.replaceChildren(new Option('All years', ''));
    years.forEach(year => yearSelect.add(new Option(String(year), String(year))));
    monthSelect.replaceChildren(new Option('All months', ''));
    months.forEach(month => monthSelect.add(new Option(MONTH_NAMES[month - 1], String(month))));
    journalSelect.replaceChildren(new Option('All journals', ''));
    journals.forEach(journal => journalSelect.add(new Option(journal, journal)));

    if ([...yearSelect.options].some(option => option.value === currentYear)) yearSelect.value = currentYear;
    if ([...monthSelect.options].some(option => option.value === currentMonth)) monthSelect.value = currentMonth;
    if ([...journalSelect.options].some(option => option.value === currentJournal)) journalSelect.value = currentJournal;
}

// ---- Render ----
function renderPublications() {
    const list = document.getElementById('pub-list');
    if (!list) return;

    const year = document.getElementById('publication-filter-year')?.value || '';
    const month = document.getElementById('publication-filter-month')?.value || '';
    const journal = document.getElementById('publication-filter-journal')?.value || '';
    const minimumCitations = Number(document.getElementById('publication-filter-citations')?.value || 0);

    const sorted = allPublications
        .filter(pub => !year || String(pub.year) === year)
        .filter(pub => !month || String(getPublicationMonth(pub)) === month)
        .filter(pub => !journal || getPublicationJournal(pub) === journal)
        .filter(pub => Number(pub.citations || 0) >= minimumCitations)
        .sort((a, b) => {
            if (publicationSort === 'citations') {
                return (b.citations || 0) - (a.citations || 0)
                    || (b.year || 0) - (a.year || 0)
                    || getPublicationMonth(b) - getPublicationMonth(a);
            }
            return (b.year || 0) - (a.year || 0)
                || getPublicationMonth(b) - getPublicationMonth(a)
                || (b.citations || 0) - (a.citations || 0);
        });

    const resultCount = document.getElementById('publication-results-count');
    if (resultCount) {
        const orderLabel = publicationSort === 'citations' ? 'most cited first' : 'newest first';
        resultCount.textContent = `Showing ${sorted.length} of ${allPublications.length} publications · ${orderLabel}`;
    }

    if (!sorted.length) {
        list.innerHTML = '<div class="publication-empty">No publications match these filters.</div>';
        return;
    }

    list.innerHTML = sorted.map((pub, idx) => {
        const typeLabel = pub.type === 'thesis' ? 'Thesis' :
                         pub.type === 'talk'   ? 'Conference Talk' : 'Journal Paper';
        const typeColor = pub.type === 'paper' ? 'var(--accent-aurora)' :
                         pub.type === 'talk'   ? 'var(--accent-warm)'   : 'var(--accent-sky)';
        const badgeStyle = `background: rgba(100,255,218,0.05); border: 1px solid rgba(100,255,218,0.12); color: ${typeColor}; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.02em;`;
        const yearStyle  = `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-secondary);`;
        const citStyle   = `background: rgba(255,169,77,0.06); border: 1px solid rgba(255,169,77,0.12); color: var(--accent-warm); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono);`;

        return `
        <div class="pub-card" style="animation-delay: ${idx * 0.01}s">
            <h3><a href="${pub.url}" target="_blank" rel="noopener">${pub.title}</a></h3>
            <p class="pub-authors" title="${pub.authors}">${pub.authors}</p>
            <p class="pub-venue" title="${pub.venue}">${pub.venue}</p>
            <div class="pub-meta" style="display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center; margin-top:0.4rem;">
                <span style="${yearStyle}">${pub.year || 'N/A'}</span>
                <span style="${badgeStyle}">${typeLabel}</span>
                ${pub.citations > 0 ? `<span style="${citStyle}">${pub.citations} citations</span>` : ''}
                <a href="${pub.url}" target="_blank" rel="noopener" class="pub-link" style="margin-left:auto; font-size: 0.72rem; font-family: var(--font-mono); color: var(--accent-aurora);">Link →</a>
            </div>
        </div>`;
    }).join('');
}

// ---- Main ----
document.addEventListener('DOMContentLoaded', async () => {
    const statPubs = document.getElementById('stat-pubs');
    const statCitations = document.getElementById('stat-citations');
    const statHindex = document.getElementById('stat-hindex');
    const statI10 = document.getElementById('stat-i10');
    const list = document.getElementById('pub-list');

    if (!list) return;

    document.querySelectorAll('[data-publication-sort]').forEach(button => {
        button.addEventListener('click', () => {
            publicationSort = button.dataset.publicationSort;
            document.querySelectorAll('[data-publication-sort]').forEach(sortButton => {
                const isActive = sortButton === button;
                sortButton.classList.toggle('is-active', isActive);
                sortButton.setAttribute('aria-pressed', String(isActive));
            });
            renderPublications();
        });
    });

    [
        'publication-filter-year',
        'publication-filter-month',
        'publication-filter-journal',
        'publication-filter-citations'
    ].forEach(id => document.getElementById(id)?.addEventListener('change', renderPublications));

    document.getElementById('publication-reset')?.addEventListener('click', () => {
        ['publication-filter-year', 'publication-filter-month', 'publication-filter-journal']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('publication-filter-citations').value = '0';
        renderPublications();
    });

    // Show loading state
    list.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem; font-family: var(--font-mono); font-size: 0.85rem;">Loading publications…</div>';

    try {
        // Load local Google Scholar data
        const response = await fetch('data/publications.json');
        if (!response.ok) throw new Error('Failed to load data/publications.json');
        let pubs = await response.json();
        setPublicationFetchTime('local Google Scholar dataset');
        allPublications = pubs;
        populatePublicationFilters(pubs);

        // Render initially with local counts
        const initialStats = computeStats(pubs);
        if (statPubs) statPubs.textContent = pubs.length;
        if (statCitations) statCitations.textContent = initialStats.totalCitations;
        if (statHindex) statHindex.textContent = initialStats.hIndex;
        if (statI10) statI10.textContent = initialStats.i10;
        renderPublications();

        // Try to update with live Semantic Scholar citations
        const liveResult = await fetchSemanticScholarUpdates(pubs);
        pubs = liveResult.publications;
        allPublications = pubs;
        if (liveResult.liveFetched) setPublicationFetchTime('Semantic Scholar');
        
        // Render again with updated counts
        const finalStats = computeStats(pubs);
        if (statCitations) statCitations.textContent = finalStats.totalCitations;
        if (statHindex) statHindex.textContent = finalStats.hIndex;
        if (statI10) statI10.textContent = finalStats.i10;
        renderPublications();

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div style="text-align:center; color: var(--accent-warm); padding: 2rem; font-family: var(--font-mono); font-size: 0.85rem;">Failed to load publications: ${err.message}</div>`;
    }
});
