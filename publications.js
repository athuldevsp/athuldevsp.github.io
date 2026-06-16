/* ============================================================
   Publications — Loaded from Google Scholar data + Semantic Scholar
   ============================================================ */

const AUTHOR_ID = '2389285019'; // Athul Dev's Semantic Scholar Author ID

// ---- Fetch live citation updates from Semantic Scholar author papers ----
async function fetchSemanticScholarUpdates(localPubs) {
    const updated = [...localPubs];
    try {
        // Fetch all papers from Semantic Scholar for this author
        const resp = await fetch(`https://api.semanticscholar.org/graph/v1/author/${AUTHOR_ID}?fields=papers.title,papers.citationCount,papers.externalIds`);
        if (resp.ok) {
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
    return updated;
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

// ---- Render ----
function renderPublications(pubs) {
    const list = document.getElementById('pub-list');
    if (!list) return;

    const sorted = [...pubs].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.citations || 0) - (a.citations || 0);
    });

    list.innerHTML = sorted.map((pub, idx) => {
        const typeLabel = pub.type === 'thesis' ? 'Thesis' :
                         pub.type === 'talk'   ? 'Conference Talk' : 'Journal Paper';
        const typeColor = pub.type === 'paper' ? 'var(--accent-aurora)' :
                         pub.type === 'talk'   ? 'var(--accent-warm)'   : 'var(--accent-sky)';
        const badgeStyle = `background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: ${typeColor}; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.02em;`;
        const yearStyle  = `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-secondary);`;
        const citStyle   = `background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.12); color: var(--accent-warm); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; font-family: var(--font-mono);`;

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

    // Show loading state
    list.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem; font-family: var(--font-mono); font-size: 0.85rem;">Loading publications…</div>';

    try {
        // Load local Google Scholar data
        const response = await fetch('data/publications.json');
        if (!response.ok) throw new Error('Failed to load data/publications.json');
        let pubs = await response.json();

        // Render initially with local counts
        const initialStats = computeStats(pubs);
        if (statPubs) statPubs.textContent = pubs.length;
        if (statCitations) statCitations.textContent = initialStats.totalCitations;
        if (statHindex) statHindex.textContent = initialStats.hIndex;
        if (statI10) statI10.textContent = initialStats.i10;
        renderPublications(pubs);

        // Try to update with live Semantic Scholar citations
        pubs = await fetchSemanticScholarUpdates(pubs);
        
        // Render again with updated counts
        const finalStats = computeStats(pubs);
        if (statCitations) statCitations.textContent = finalStats.totalCitations;
        if (statHindex) statHindex.textContent = finalStats.hIndex;
        if (statI10) statI10.textContent = finalStats.i10;
        renderPublications(pubs);

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div style="text-align:center; color: var(--accent-warm); padding: 2rem; font-family: var(--font-mono); font-size: 0.85rem;">Failed to load publications: ${err.message}</div>`;
    }
});
