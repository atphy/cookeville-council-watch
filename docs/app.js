const records = document.querySelector('#records');
const showNoComment = document.querySelector('#show-no-comment');

function opinions(comment) {
  if (comment.opinions) return comment.opinions;
  if (comment.status === 'counted' && comment.sentiment === 'support') return { for: comment.speaker_count, against: 0, other: 0 };
  if (comment.status === 'counted' && comment.sentiment === 'oppose') return { for: 0, against: comment.speaker_count, other: 0 };
  if (comment.status === 'counted' && comment.sentiment === 'procedural-question') return { for: 0, against: 0, other: comment.speaker_count };
  if (comment.status === 'none') return { for: 0, against: 0, other: 0 };
  return null;
}

function sentimentDirection(comment) {
  const counts = opinions(comment);
  if (!counts) return 'review';
  if (counts.against > counts.for && counts.against > 0) return 'against';
  if (counts.for > counts.against && counts.for > 0) return 'for';
  if (counts.for || counts.against || counts.other) return 'mixed';
  return 'none';
}

function comparisonClass(action) {
  const direction = sentimentDirection(action.public_comment);
  if (direction === 'none') return 'none';
  if (direction === 'review') return 'review';
  if (direction === 'mixed') return 'other';
  if (action.outcome === 'passed') return direction === 'for' ? 'alignment' : 'discrepancy';
  if (action.outcome === 'rejected') return direction === 'against' ? 'alignment' : 'discrepancy';
  return 'other';
}

function comparisonLabel(action) {
  const direction = sentimentDirection(action.public_comment);
  const temporary = action.public_comment.is_sample ? ' · temporary sample data' : '';
  if (comparisonClass(action) === 'alignment') return `Council action matched net public opinion${temporary}`;
  if (comparisonClass(action) === 'discrepancy') {
    return action.outcome === 'passed'
      ? `Council passed despite net public opposition${temporary}`
      : `Council action ran contrary to net public opinion${temporary}`;
  }
  if (direction === 'mixed') return 'Mixed public opinion';
  if (direction === 'review') return 'Public-comment record needs review';
  return 'No public comment recorded';
}

function opinionSummary(comment) {
  const counts = opinions(comment);
  if (!counts) return '';
  return `<span class="opinion for">For <b>${counts.for}</b></span><span class="opinion against">Against <b>${counts.against}</b></span><span class="opinion other">Other <b>${counts.other}</b></span>`;
}

function referenceMarkup(action) {
  const reference = action.item_label.split(' · ').find(part =>
    part.startsWith('Resolution ') || part.startsWith('Ordinance ')
  );
  if (!reference) return '';
  const [kind, ...number] = reference.split(' ');
  return `<p class="reference"><span>${kind} number</span> ${number.join(' ')}</p>`;
}

function voteLabel(votes) {
  if (votes.status === 'verification-needed') return 'Outcome recorded; individual votes need verification';
  return Object.entries(votes.members).map(([name, vote]) => `${name}: ${vote}`).join(' · ');
}

function voteMarkup(votes) {
  if (votes.status === 'verification-needed') {
    return '<div class="council-vote pending"><span class="section-label">Council vote</span><span>Outcome recorded; individual member votes need verification</span></div>';
  }
  const labels = { aye: 'Yes', nay: 'No', absent: '(absent)', abstain: '(abstained)', recused: '(recused)' };
  const members = Object.entries(votes.members).map(([name, vote]) => {
    const state = ['aye', 'nay'].includes(vote) ? vote : 'not-voting';
    return `<span class="member-vote ${state}"><b>${name}</b> <span>${labels[vote] || `(${vote})`}</span></span>`;
  }).join('');
  return `<div class="council-vote"><span class="section-label">Council vote</span><span class="member-votes">${members}</span></div>`;
}

function show(data) {
  const actions = data.actions;
  document.querySelector('#action-count').textContent = actions.length;
  const passedDespiteOpposition = actions.filter(action =>
    action.outcome === 'passed' && comparisonClass(action) === 'discrepancy'
  ).length;
  const matchedOpinion = actions.filter(action => comparisonClass(action) === 'alignment').length;
  const countedRemarks = actions.reduce((sum, action) => {
    const c = opinions(action.public_comment);
    return sum + (c ? c.for + c.against + c.other : 0);
  }, 0);
  document.querySelector('#opposition-pass-count').textContent = passedDespiteOpposition;
  document.querySelector('#alignment-count').textContent = matchedOpinion;
  document.querySelector('#remark-count').textContent = countedRemarks;

  function render() {
    const visible = actions.filter(action => showNoComment.checked || action.public_comment.status === 'counted');
    records.innerHTML = visible.map(action => {
      const c = action.public_comment;
      const evidence = action.evidence.map(e => {
        const source = e.file.replace('-city-council-minutes.pdf', '');
        return e.page ? `${source}, p. ${e.page}` : `${source}${e.note ? ` (${e.note})` : ''}`;
      }).join('; ');
      const reference = referenceMarkup(action);
      return `<article class="record ${comparisonClass(action)}">
        <div class="record-head"><p>${action.date} · ${action.item_label}</p><span class="outcome">${action.outcome}</span></div>
        ${reference}
        <h3>${action.title}</h3>
        <div class="public-opinions"><span class="section-label">Public comment</span><div class="opinions">${opinionSummary(c)}<span class="comparison ${comparisonClass(action)}">${comparisonLabel(action)}</span></div></div>
        ${voteMarkup(action.votes)}
      </article>`;
    }).join('') || '<p class="empty">No comment records need review yet. Check “Show items with no public comment” to browse the full record.</p>';
  }
  showNoComment.addEventListener('change', render);
  render();
}

fetch('data/actions.json?v=20261002-clean-records-1').then(response => response.json()).then(show).catch(() => {
  records.innerHTML = '<p class="empty">The public data file could not be loaded.</p>';
});
