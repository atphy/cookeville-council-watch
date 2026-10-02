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
  if (comment.status === 'none') return '';
  const counts = opinions(comment);
  if (!counts) return '';
  return `<span class="opinion for">For <b>${counts.for}</b></span><span class="opinion against">Against <b>${counts.against}</b></span><span class="opinion other">Other <b>${counts.other}</b></span>`;
}

function agendaItemLabel(action) {
  const [item, ...rest] = action.item_label.split(' · ');
  return `Agenda item ${item}${rest.length ? ` · ${rest.join(' · ')}` : ''}`;
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
  const commentedActions = actions.filter(action => action.public_comment.status === 'counted').length;
  document.querySelector('#opposition-pass-count').textContent = passedDespiteOpposition;
  document.querySelector('#commented-action-count').textContent = commentedActions;

  function render() {
    const visible = actions.filter(action => showNoComment.checked || action.public_comment.status === 'counted');
    records.innerHTML = visible.map(action => {
      const c = action.public_comment;
      const agendaItem = agendaItemLabel(action);
      return `<article class="record ${comparisonClass(action)}">
        <div class="record-head"><p>${action.date} · ${agendaItem}</p><span class="outcome">${action.outcome}</span></div>
        <h3>${action.title}</h3>
        <div class="public-opinions"><span class="section-label">Public comment</span><div class="opinions">${opinionSummary(c)}<span class="comparison ${comparisonClass(action)}">${comparisonLabel(action)}</span></div></div>
        ${voteMarkup(action.votes)}
        <details><summary>Comment note</summary><p>${c.note}</p></details>
      </article>`;
    }).join('') || '<p class="empty">No comment records need review yet. Check “Show items with no public comment” to browse the full record.</p>';
  }
  showNoComment.addEventListener('change', render);
  render();
}

fetch('data/actions.json?v=20261002-clear-headers-1').then(response => response.json()).then(show).catch(() => {
  records.innerHTML = '<p class="empty">The public data file could not be loaded.</p>';
});
