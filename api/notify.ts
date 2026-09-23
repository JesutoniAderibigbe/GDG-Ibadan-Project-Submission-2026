import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel serverless function: notifies the organizer by email when a new
// submission comes in. Runs server-side so the Resend API key never reaches
// the browser -- unlike the Cloudinary credentials, this one is a real secret.
//
// Called fire-and-forget from SubmissionForm right after a successful
// Firestore write. A failure here (Resend down, quota exceeded, etc.) must
// never surface as a submission failure to the participant.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { teamName, email, projectTitle, projectLink, aiToolsUsed } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof teamName !== 'string' || typeof projectTitle !== 'string' || !teamName.trim() || !projectTitle.trim()) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    console.error('Notify handler: RESEND_API_KEY or NOTIFY_EMAIL is not configured');
    res.status(500).json({ error: 'Email notifications are not configured' });
    return;
  }

  const link = typeof projectLink === 'string' ? projectLink : '';
  const tools = typeof aiToolsUsed === 'string' ? aiToolsUsed : '';
  const contactEmail = typeof email === 'string' ? email : '';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DevFest Ibadan 2026 <onboarding@resend.dev>',
        to: [notifyEmail],
        subject: `New submission: ${projectTitle}`,
        html: `
          <h2>New project submission</h2>
          <p><strong>Team:</strong> ${escapeHtml(teamName)}</p>
          ${contactEmail ? `<p><strong>Contact:</strong> ${escapeHtml(contactEmail)}</p>` : ''}
          <p><strong>Project:</strong> ${escapeHtml(projectTitle)}</p>
          ${link ? `<p><strong>Demo:</strong> <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : ''}
          ${tools ? `<p><strong>AI tools used:</strong> ${escapeHtml(tools)}</p>` : ''}
          <p><a href="https://devfest-ibadan-2026.vercel.app/judges">View in Judges Dashboard</a></p>
        `,
      }),
    });

    if (!resendRes.ok) {
      const text = await resendRes.text();
      console.error('Resend API error:', resendRes.status, text);
      res.status(502).json({ error: 'Failed to send notification email' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notify handler error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
