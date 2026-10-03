const records = document.querySelector('#records');
const showNoComment = document.querySelector('#show-no-comment');
const featuredFinding = document.querySelector('#featured-finding');
const findingDetail = document.querySelector('#finding-detail');
const meetingTimeline = document.querySelector('#meeting-timeline');

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

function outcomeLabel(action) {
  return action.outcome === 'passed' ? 'Passed' : action.outcome.charAt(0).toUpperCase() + action.outcome.slice(1);
}

function publicSummary(action) {
  const direction = sentimentDirection(action.public_comment);
  if (direction === 'against') return 'Net public opposition';
  if (direction === 'for') return 'Net public support';
  if (direction === 'mixed') return 'Mixed or unclear';
  if (direction === 'review') return 'Record needs review';
  return 'No public comment recorded';
}

function decisionFlowMarkup(action) {
  const comparison = comparisonClass(action);
  return `<div class="decision-flow ${comparison}" aria-label="Public comment and council action">
    <div class="flow-step public ${sentimentDirection(action.public_comment)}"><span>Public comment</span><b>${publicSummary(action)}</b></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="flow-step action ${comparison}"><span>Council action</span><b>${outcomeLabel(action)}</b></div>
  </div>`;
}

function formatMeetingDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function renderMeetingTimeline(actions) {
  const meetings = [...new Map(actions.map(action => [action.date, []])).entries()]
    .map(([date]) => {
      const meetingActions = actions.filter(action => action.date === date);
      const comments = meetingActions.filter(action => action.public_comment.status === 'counted').length;
      const discrepancies = meetingActions.filter(action => comparisonClass(action) === 'discrepancy').length;
      return { date, total: meetingActions.length, comments, discrepancies };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  meetingTimeline.innerHTML = meetings.map(meeting => `<li class="meeting-stop">
    <span class="timeline-dot" aria-hidden="true"></span>
    <time datetime="${meeting.date}">${formatMeetingDate(meeting.date)}</time>
    <div><b>${meeting.total} action${meeting.total === 1 ? '' : 's'} logged</b><span>${meeting.comments} with public comment · ${meeting.discrepancies} passed despite opposition</span></div>
  </li>`).join('');
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
  const warning = votes.status === 'recorded-with-warning'
    ? `<span class="vote-warning">Names as logged in minutes; potential roster error.</span>`
    : '';
  const label = votes.motion_label || 'Council vote';
  return `<div class="council-vote"><span class="section-label">${label}</span><span class="member-votes">${members}</span>${warning}</div>`;
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
  featuredFinding.textContent = `${passedDespiteOpposition} action${passedDespiteOpposition === 1 ? '' : 's'} passed despite net public opposition`;
  findingDetail.textContent = 'A comparison of recorded outcomes with item-specific public-comment blocks in the meetings logged below.';
  renderMeetingTimeline(actions);

  function render() {
    const visible = actions.filter(action => showNoComment.checked || action.public_comment.status === 'counted');
    records.innerHTML = visible.map(action => {
      const c = action.public_comment;
      const agendaItem = agendaItemLabel(action);
      return `<article class="record ${comparisonClass(action)}">
        <div class="record-head"><p>${action.date} · ${agendaItem}</p><span class="outcome">${action.outcome}</span></div>
        <h3>${action.title}</h3>
        <div class="public-opinions"><span class="section-label">Public comment</span><div class="opinions">${opinionSummary(c)}<span class="comparison ${comparisonClass(action)}">${comparisonLabel(action)}</span></div></div>
        ${decisionFlowMarkup(action)}
        ${voteMarkup(action.votes)}
        <details><summary>Additional information</summary><p>${c.note}</p>${action.votes.note ? `<p><strong>Vote note:</strong> ${action.votes.note}</p>` : ''}</details>
      </article>`;
    }).join('') || '<p class="empty">No comment records need review yet. Check “Show items with no public comment” to browse the full record.</p>';
  }
  showNoComment.addEventListener('change', render);
  render();
}

fetch('data/actions.json?v=20261002-natural-notes-1').then(response => response.json()).then(show).catch(() => {
  records.innerHTML = '<p class="empty">The public data file could not be loaded.</p>';
});
