const records = document.querySelector('#records');
const showNoComment = document.querySelector('#show-no-comment');

function commentClass(comment) {
  if (comment.status === 'none') return 'none';
  if (comment.status === 'counted') return 'counted';
  return 'review';
}

function opinions(comment) {
  if (comment.opinions) return comment.opinions;
  if (comment.status === 'counted' && comment.sentiment === 'support') return { for: comment.speaker_count, against: 0, other: 0 };
  if (comment.status === 'counted' && comment.sentiment === 'oppose') return { for: 0, against: comment.speaker_count, other: 0 };
  if (comment.status === 'counted' && comment.sentiment === 'procedural-question') return { for: 0, against: 0, other: comment.speaker_count };
  if (comment.status === 'none') return { for: 0, against: 0, other: 0 };
  return null;
}

function opinionClass(comment) {
  const counts = opinions(comment);
  if (!counts) return comment.status === 'none' ? 'none' : 'review';
  if (counts.against > counts.for && counts.against > 0) return 'against';
  if (counts.for > counts.against && counts.for > 0) return 'for';
  if (counts.other > 0) return 'other';
  return 'none';
}

function opinionSummary(comment) {
  const counts = opinions(comment);
  if (!counts) return 'Needs manual review';
  return `<span class="opinion for">For <b>${counts.for}</b></span><span class="opinion against">Against <b>${counts.against}</b></span><span class="opinion other">Other <b>${counts.other}</b></span>`;
}

function voteLabel(votes) {
  if (votes.status === 'verification-needed') return 'Outcome recorded; individual votes need verification';
  return Object.entries(votes.members).map(([name, vote]) => `${name}: ${vote}`).join(' · ');
}

function show(data) {
  const actions = data.actions;
  document.querySelector('#action-count').textContent = actions.length;
  const total = (key) => actions.reduce((sum, action) => sum + (opinions(action.public_comment)?.[key] || 0), 0);
  document.querySelector('#for-count').textContent = total('for');
  document.querySelector('#against-count').textContent = total('against');
  document.querySelector('#other-count').textContent = total('other');

  function render() {
    const visible = actions.filter(action => showNoComment.checked || action.public_comment.status !== 'none');
    records.innerHTML = visible.map(action => {
      const c = action.public_comment;
      const evidence = action.evidence.map(e => `${e.file.replace('-city-council-minutes.pdf', '')}, p. ${e.page}`).join('; ');
      return `<article class="record ${opinionClass(c)}">
        <div class="record-head"><p>${action.date} · ${action.item_label}</p><span class="outcome">${action.outcome}</span></div>
        <h3>${action.title}</h3>
        <div class="opinions">${opinionSummary(c)}</div>
        <details><summary>Votes & source</summary><p><strong>Vote:</strong> ${voteLabel(action.votes)}</p><p><strong>Evidence:</strong> ${evidence}</p><p>${c.note}</p></details>
      </article>`;
    }).join('') || '<p class="empty">No comment records need review yet. Check “Show items with no public comment” to browse the full record.</p>';
  }
  showNoComment.addEventListener('change', render);
  render();
}

fetch('data/actions.json').then(response => response.json()).then(show).catch(() => {
  records.innerHTML = '<p class="empty">The public data file could not be loaded.</p>';
});
